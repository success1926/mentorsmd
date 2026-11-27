"use client";

import { useCallback, useEffect, useState } from "react";
import { CompareToggle, CompareTray, compareSnapshot, useCompare } from "@/components/Compare";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { EmptyState, Icon, ICONS, Rating, tintFor, initialsOf } from "@/components/ui";
import { fmtDateTime, fmtDay } from "@/lib/format";
import { profileBasics } from "./profileData";
import { StarsFill } from "@/components/Moments";
import { MOMENTS } from "@/lib/moments";
import { SchoolLogo } from "@/components/SchoolLogo";
import type { LogoMap } from "@/lib/schoolLogoKey";
import { Modal } from "@/components/Modal";
import { CountText, useCountUp } from "@/components/CountUp";
import { Booker } from "@/components/Booker";
import { AboutYouNudge } from "@/components/AboutYouNudge";
import { ConfirmEmailNotice, ReportDialog, SendWarnings, setBlocked, type SendWarning } from "@/components/Safety";
import { trackEvent } from "@/components/Tracker";
import { FORMATS, INTRO_CALL_MINUTES, SCHOOL_TYPES, credentialLine, labelFor, money, serviceLabel } from "@/lib/options";
import { hoursLabel, priceMath } from "@/lib/pricing";
import { splitCredit } from "@/lib/hours";
import { focusPosition, stripFocus } from "@/lib/imageFocus";
import type { Language } from "@/lib/profileCompleteness";
import { useConfirm } from "@/components/ConfirmDialog";

// A mentor's public profile (docs/redesign-2026-10.md sections 1 and 2;
// "badge" layout Nov 26 2026). Top: the mentor's badge (photo with their
// school's logo, name, credential, school, best for) beside the prices in
// order: hourly (with the free intro call and Message), hour packs, then
// bigger packages. Below, full width: labelled sections (About, Known for,
// Specialties, Admissions experience, Credentials, Clinical & research,
// Languages, Fun fact) and reviews. Every Details / Buy /
// intro call / message action opens as a pop-up here, never a new page.
// The sections that don't change (About ... Fun fact, the reviews list)
// are rendered on the server (ProfileStatic.tsx) and come in as `body`
// and `reviewList`.

export type PublicOffer = {
  id: string;
  kind: "HOURLY" | "BUNDLE" | "SPECIALIZED";
  title: string;
  description: string;
  minutes: number;
  rateCents: number;
  price: number;
  format: string | null;
  service: string | null;
  serviceOther: string | null;
  coverUrl: string | null;
  hiddenFromStudents?: boolean; // preview only: students can't see or buy it yet
};

type Offers = { hourly: PublicOffer | null; bundles: PublicOffer[]; packages: PublicOffer[] };

type Unlock = {
  unlocked: boolean;
  reason: string | null;
  conversationId: string | null;
  messaged: boolean;
  introCall: { id: string; startTime: string; endTime: string; status: string; outcome: string | null; canCancel: boolean } | null;
  canBookIntro: boolean;
  introBlockedReason: string | null;
};

type Dialog = null | { t: "all" } | { t: "details"; offerId: string; fromAll?: boolean } | { t: "intro" } | { t: "message" };

// Bigger packages listed beside the badge before "See all N packages".
const PACKAGES_SHOWN = 3;

const LOCKED_TEXT = "Message or book an intro call to unlock";
const INTRO_TEXT = "Say hello, talk through where you are in your application, and see if you're a good fit. There's nothing to pay. One intro call per mentor.";

const fmtWhen = (iso: string) => fmtDateTime(iso, { zone: true });

function offerLabel(o: PublicOffer) {
  if (o.kind === "HOURLY") return "1 hour";
  if (o.kind === "BUNDLE") return `${hoursLabel(o.minutes)} bundle`;
  return o.title;
}

// Preview (mentor area v2, Oct 2026): what the mentor sees on their own
// profile. The page looks exactly as it does for students; the buttons
// that would act (buy, message, intro call) are shown but switched off.
export type PreviewState = "LIVE" | "INCOMPLETE" | "PAUSED" | "REMOVED" | "HOLD" | null;

const PREVIEW_STATE_TEXT: Record<Exclude<PreviewState, null>, string> = {
  LIVE: "Live on Browse",
  INCOMPLETE: "Hidden from Browse until complete",
  PAUSED: "Hidden from Browse while paused",
  REMOVED: "Removed from the site",
  HOLD: "Hidden from Browse during a safety review",
};

const STUDENTS_SEE = "Students see these buttons";

// A button as students see it, switched off in preview. The tooltip sits
// on a wrapper because disabled buttons don't show one in every browser.
function PreviewOnly({ children, block = false }: { children: React.ReactNode; block?: boolean }) {
  return (
    <span title={STUDENTS_SEE} style={{ display: block ? "block" : "inline-block", cursor: "not-allowed" }}>
      <span style={{ display: "contents", pointerEvents: "none" }}>{children}</span>
    </span>
  );
}

function NotVisibleTag() {
  return <span className="preview-tag" title="Only you can see this in preview">Not visible to students</span>;
}

export function ProfileClient({ seller, offers, reviews, previewState = null, logos = {}, body, reviewList }: { seller: any; offers: Offers; reviews: any[]; previewState?: PreviewState; logos?: LogoMap; body: React.ReactNode; reviewList: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = (session?.user as any)?.role;
  const isBuyer = role === "BUYER";
  const isSelf = (session?.user as any)?.id === seller.id;
  const preview = isSelf && previewState !== null;
  const { first, reviewCount, avg, bestFor, school, rank, clientSchools, specialties, roles, highlights, knownFor, languages, facts } = profileBasics(seller, offers, reviews);
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/mentors/${seller.id}`)}`;

  const [unlock, setUnlock] = useState<Unlock | null>(null);
  const [unlockError, setUnlockError] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlockedState] = useState<{ iBlocked: boolean; theyBlocked: boolean } | null>(null);
  // Either side blocked the other: no booking or buying (the server refuses too).
  const blockedNote = blocked?.iBlocked ? `You blocked ${first}. Unblock them to book or buy.` : blocked?.theyBlocked ? `You can't book with ${first}.` : "";

  const allOffers = [...(offers.hourly ? [offers.hourly] : []), ...offers.bundles, ...offers.packages];
  const canTakeStudents = seller.listed && !seller.adultsOnlyForViewer;

  const loadUnlock = useCallback(() => {
    if (!isBuyer) return;
    fetch(`/api/mentors/${seller.id}/unlock`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // No answer: say so instead of leaving the intro-call panel on "Loading…".
        setUnlockError(!d);
        if (d) setUnlock(d);
      })
      .catch(() => setUnlockError(true));
  }, [isBuyer, seller.id]);
  useEffect(loadUnlock, [loadUnlock]);

  useEffect(() => {
    if (!session) return;
    fetch(`/api/blocks?userId=${seller.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBlockedState({ iBlocked: !!d.iBlocked, theyBlocked: !!d.theyBlocked }))
      .catch(() => {});
  }, [session, seller.id]);

  // Private activity log (#86): one profile view per visit. The server
  // skips the mentor's own views and admins.
  useEffect(() => {
    if (status === "loading") return;
    trackEvent({ kind: "PROFILE_VIEW", mentorId: seller.id });
  }, [status, seller.id]);

  // Browse cards link to ?package=<id>: open that package's details.
  useEffect(() => {
    const id = searchParams?.get("package");
    if (id && allOffers.some((o) => o.id === id)) setDialog({ t: "details", offerId: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ask = useConfirm();
  async function toggleBlock(block: boolean) {
    if (block && !(await ask.confirm({ title: `Block ${seller.name}?`, body: "Neither of you will be able to message the other.", confirmLabel: "Block", cancelLabel: "Keep it", danger: true }))) return;
    try {
      await setBlocked(seller.id, block);
      setBlockedState({ iBlocked: block, theyBlocked: blocked?.theyBlocked || false });
    } catch (e: any) {
      await ask.notify("Couldn't update", e.message);
    }
  }

  const closeDialog = () => setDialog(null);
  const current = dialog?.t === "details" ? allOffers.find((o) => o.id === dialog.offerId) : null;
  // The hourly rate shown at the top of the price column.
  const hourlyRate: number | null = offers.hourly?.rateCents ?? seller.hourlyRateCents ?? null;

  // Compare (Nov 2026): this mentor as the compare tray shows them.
  const bookable = allOffers.filter((o) => !o.hiddenFromStudents);
  const compareMe = compareSnapshot({
    id: seller.id,
    name: seller.name,
    photoUrl: seller.photoUrl,
    mentorStage: seller.mentorStage,
    school,
    hourlyRateCents: offers.hourly?.rateCents ?? seller.hourlyRateCents ?? null,
    fromRateCents: bookable.length ? Math.min(...bookable.map((o) => o.rateCents)) : null,
    packageCount: offers.packages.filter((p) => !p.hiddenFromStudents).length,
    bestFor: seller.bestFor || [],
    strongestStages: seller.strongestStages || [],
    packageServices: offers.packages.map((p) => p.service).filter((s): s is string => !!s),
    offerPrices: bookable.map((o) => o.price),
    roleTypes: roles.map((r) => r.type),
    knownFor: (seller.knownFor || [])[0] || null,
    languages: (seller.languages || []).map((l: Language) => l.name),
    avgRating: avg,
    reviewCount,
  });
  const compare = useCompare();
  useEffect(() => {
    if (!preview) compare.refresh(compareMe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller.id]);

  // "Free intro call" on Browse and in the compare tray link to ?intro=1.
  useEffect(() => {
    if (searchParams?.get("intro") !== "1" || status === "loading") return;
    if (isBuyer && !preview) setDialog({ t: "intro" });
    else if (!session) router.replace(loginHref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // The two main actions, beside the hourly rate.
  const actions = (stack = true) =>
    preview ? (
      <div className={stack ? "stack-sm" : "row-wrap"}>
        <PreviewOnly block={stack}>
          <button className={`btn btn-primary ${stack ? "btn-block" : ""}`} disabled>
            <Icon d={ICONS.video} size={18} /> Book free {INTRO_CALL_MINUTES}-min intro call
          </button>
        </PreviewOnly>
        <PreviewOnly block={stack}>
          <button className={`btn ${stack ? "btn-block" : ""}`} disabled>Message {first}</button>
        </PreviewOnly>
      </div>
    ) : isBuyer ? (
      <div className={stack ? "stack-sm" : "row-wrap"}>
        <button className={`btn btn-primary ${stack ? "btn-block" : ""}${MOMENTS.profileStars ? " mm-glow-once" : ""}`} disabled={!canTakeStudents || !!blockedNote} onClick={() => setDialog({ t: "intro" })} aria-haspopup="dialog">
          <Icon d={ICONS.video} size={18} /> Book free {INTRO_CALL_MINUTES}-min intro call
        </button>
        <button className={`btn ${stack ? "btn-block" : ""}`} disabled={!seller.available || seller.adultsOnlyForViewer} onClick={() => setDialog({ t: "message" })} aria-haspopup="dialog">
          Message {first}
        </button>
      </div>
    ) : status !== "loading" && !session ? (
      <div className={stack ? "stack-sm" : "row-wrap"}>
        <Link href={loginHref} className={`btn btn-primary ${stack ? "btn-block" : ""}${MOMENTS.profileStars ? " mm-glow-once" : ""}`}>Book free {INTRO_CALL_MINUTES}-min intro call</Link>
        <Link href="/signup" className={`btn ${stack ? "btn-block" : ""}`}>Create a free account to message</Link>
      </div>
    ) : (
      <span className="text-muted">{isSelf ? "This is how students see your profile." : "Only student accounts can book or message mentors."}</span>
    );

  // Sections, in page order, for the menu at the top of the right column.
  const sections: { id: string; label: string }[] = [
    ...(seller.bio || facts.length || clientSchools.length ? [{ id: "about", label: "About" }] : []),
    ...(knownFor.length ? [{ id: "known", label: "Known for" }] : []),
    ...(specialties.length || bestFor.length ? [{ id: "specialties", label: "Specialties" }] : []),
    ...(roles.length || (seller.strongestStages || []).length || typeof seller.yearsAdvising === "number" || typeof seller.applicantsSupported === "number" ? [{ id: "experience", label: "Experience" }] : []),
    ...(highlights.length ? [{ id: "credentials", label: "Credentials" }] : []),
    ...(seller.specialtyInterest || seller.researchSummary ? [{ id: "research", label: "Research" }] : []),
    ...(languages.length || seller.funFact ? [{ id: "more", label: languages.length && seller.funFact ? "Languages & fun fact" : languages.length ? "Languages" : "Fun fact" }] : []),
    { id: "reviews", label: "Reviews" },
  ];

  return (
    <div className="pf">
      <section className="pf-hero">
        <div className="blob pf-blob-1" />
        <div className="blob pf-blob-2" />
        <div className="blob pf-blob-3" />
        <div className="pf-wrap stack" style={{ gap: 16 }}>
          {preview && previewState ? (
            <div className="preview-banner" role="note">
              <b>Preview</b>
              <span>— this is how students see your profile.</span>
              <span className={`badge ${previewState === "LIVE" ? "badge-success" : "badge-warning"}`}>{PREVIEW_STATE_TEXT[previewState]}</span>
              <span aria-hidden="true">·</span>
              <Link href="/dashboard/profile" className="link">Back to editing</Link>
            </div>
          ) : (
            <nav aria-label="Breadcrumb" className="pf-crumb">
              <Link href="/mentors" className="link">← All mentors</Link>
              <span aria-hidden="true">/</span>
              <span>{seller.name}</span>
            </nav>
          )}
          {searchParams?.get("checkout") === "cancelled" && (
            <div className="alert">Checkout cancelled. Nothing was charged, and any MentorsMD credit is back in your balance.</div>
          )}
          {preview && previewState === "INCOMPLETE" && (
            <div className="alert alert-warning">
              <b>Your profile isn&apos;t listed yet.</b> Students can&apos;t find or buy from you until every step is filled in. <Link href="/dashboard/profile" className="link">Finish your profile</Link>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Badge + prices (Nov 26 2026) ----------
          Left: the mentor's "hospital badge" (photo with their school's
          logo, name, credential, school, best for). Right, in order: the
          hourly rate, hour packs (bundles), then bigger packages, plus
          the free intro call and Message. */}
      <section className="pf-top">
        <div className="pf-wrap pf-top-grid">
          <div className="pf-badge-col">
            <span className="pf-lanyard" aria-hidden="true"><span /></span>
            <div className="pf-badge">
              <div className="pf-badge-strip">
                <span>MentorsMD</span>
                <span className="pf-badge-role">Mentor</span>
              </div>
              <div className="pf-photo">
                {seller.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seller.photoUrl} alt={seller.name} width={340} height={340} sizes="(max-width: 900px) 100vw, 340px" decoding="async" fetchPriority="high" />
                ) : (
                  <span className="avatar" style={{ background: tintFor(seller.id) }}>{initialsOf(seller.name)}</span>
                )}
                {school && (
                  <span className="pf-badge-logo">
                    <SchoolLogo name={school} logos={logos} size={60} />
                  </span>
                )}
              </div>
              <div className="pf-info">
                <div className="between" style={{ alignItems: "flex-start", gap: 10 }}>
                  <h1 className="pf-name">{seller.name}</h1>
                  {reviewCount === 0 && <span className="badge badge-brand" style={{ marginTop: 6 }}>New</span>}
                </div>
                {credentialLine(seller.credential, seller.mentorStage) && <span className="pf-cred">{credentialLine(seller.credential, seller.mentorStage)}</span>}
                {(school || rank) && (
                  <span className="pf-school">
                    {school && <b>{school}</b>}
                    <span className="text-secondary">{[rank, labelFor(SCHOOL_TYPES, seller.schoolType)].filter(Boolean).join(" · ")}</span>
                  </span>
                )}
                {reviewCount > 0 && (MOMENTS.profileStars && avg !== null ? <StarsFill avg={avg} count={reviewCount} /> : <Rating avg={avg} count={reviewCount} />)}
                {bestFor.length > 0 && (
                  <div className="row-wrap" style={{ gap: 6 }} aria-label="Best for">
                    {bestFor.map((t) => <span key={t} className="badge">{t}</span>)}
                  </div>
                )}
              </div>
            </div>

            {session && (role === "BUYER" || role === "SELLER") && !isSelf && (
              <div className="row-wrap small" style={{ justifyContent: "center" }}>
                <button type="button" className="link-btn" onClick={() => setReportOpen(true)}>Report {first}</button>
                <span className="text-muted">·</span>
                {blocked?.iBlocked ? (
                  <button type="button" className="link-btn" onClick={() => toggleBlock(false)}>Unblock</button>
                ) : (
                  <button type="button" className="link-btn" onClick={() => toggleBlock(true)}>Block</button>
                )}
                <span className="text-muted">·</span>
                <Link href="/safety" className="link">Safety tips</Link>
              </div>
            )}
            <ReportDialog
              open={reportOpen}
              onClose={() => setReportOpen(false)}
              subject={{ id: seller.id, name: seller.name }}
              onDone={(b) => b && setBlockedState({ iBlocked: true, theyBlocked: blocked?.theyBlocked || false })}
            />
          </div>

          <div className="pf-buy">
            {!seller.available && (
              <div className="alert alert-warning">
                <b>{first} is away{seller.pausedUntil ? ` until ${fmtDay(seller.pausedUntil, { timeZone: "UTC" })}` : ""}.</b>{" "}
                {seller.status === "REMOVED" ? "This profile has been removed." : seller.awayNote || "New orders are paused for now."}
              </div>
            )}
            {seller.adultsOnlyForViewer && (
              <div className="alert alert-warning">
                <b>{first} works with students 18 and over.</b> You can still read their profile, but you can&apos;t message or book them. Browse other mentors who work with students under 18.
              </div>
            )}

            {/* 1. Hourly, with the free intro call and Message */}
            <div className="pf-hourly">
              {hourlyRate !== null && (
                <div className="pf-hourly-rate">
                  <span className="pf-label">Hourly</span>
                  <span className="pf-rate-big">{money(hourlyRate)}<small> / hour</small></span>
                  <span className="text-muted small">Calls and written work</span>
                </div>
              )}
              <div className="pf-hourly-actions">
                {actions(false)}
                {offers.hourly &&
                  (preview ? (
                    <PreviewOnly>
                      <button className="btn btn-dark" disabled>Buy 1 hour</button>
                    </PreviewOnly>
                  ) : (
                    <button className="btn btn-dark" disabled={!!blockedNote} onClick={() => setDialog({ t: "details", offerId: offers.hourly!.id })} aria-haspopup="dialog">
                      Buy 1 hour
                    </button>
                  ))}
              </div>
              {offers.hourly?.hiddenFromStudents && <NotVisibleTag />}
              {!seller.listed && !isSelf && seller.available && <span className="text-muted small">{first} isn&apos;t taking new students right now.</span>}
              {isBuyer && blockedNote ? <span className="text-muted small">{blockedNote}</span> : isBuyer && unlock && <UnlockNote unlock={unlock} first={first} />}
            </div>

            {/* 2. Hour packs (bundles) */}
            {offers.bundles.length > 0 && (
              <div className="pf-buy-group">
                <span className="pf-buy-title">Hour packs <span>· use the hours for calls or written work, whenever you need them</span></span>
                <div className="pf-packs">
                  {offers.bundles.map((o) => {
                    const save = offers.hourly && o.rateCents < offers.hourly.rateCents ? Math.round((1 - o.rateCents / offers.hourly.rateCents) * 100) : 0;
                    return (
                      <button key={o.id} type="button" className="pf-pack" onClick={() => setDialog({ t: "details", offerId: o.id })} aria-haspopup="dialog">
                        <b>{hoursLabel(o.minutes)}</b>
                        <span className="pf-pack-price">{money(o.price)}</span>
                        <small>{money(o.rateCents)}/hr{save > 0 ? ` · save ${save}%` : ""}</small>
                        {o.hiddenFromStudents && <NotVisibleTag />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Bigger packages */}
            {offers.packages.length > 0 && (
              <div className="pf-buy-group" id="pf-packages">
                <span className="pf-buy-title">Bigger packages <span>· a set plan with a finished result</span></span>
                <div className="pf-tickets">
                  {offers.packages.slice(0, PACKAGES_SHOWN).map((p) => (
                    <button key={p.id} type="button" className="pf-ticket" onClick={() => setDialog({ t: "details", offerId: p.id })} aria-haspopup="dialog">
                      {p.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={stripFocus(p.coverUrl)} alt="" loading="lazy" decoding="async" width={72} height={72} style={{ objectPosition: focusPosition(p.coverUrl) }} />
                      )}
                      <span className="pf-ticket-body">
                        <b>{p.title}</b>
                        <span>About {hoursLabel(p.minutes)} · {labelFor(FORMATS, p.format)}</span>
                        {p.hiddenFromStudents && <NotVisibleTag />}
                      </span>
                      <span className="pf-ticket-stub">{money(p.price)}</span>
                    </button>
                  ))}
                </div>
                {offers.packages.length > PACKAGES_SHOWN && (
                  <button type="button" className="link-btn" style={{ alignSelf: "flex-start", fontWeight: 700 }} onClick={() => setDialog({ t: "all" })} aria-haspopup="dialog">
                    See all {offers.packages.length} packages →
                  </button>
                )}
              </div>
            )}

            {allOffers.length === 0 && (
              <EmptyState action={preview ? <Link href="/dashboard/packages" className="link">Set your rate</Link> : undefined}>
                {first} hasn&apos;t set up their hours yet. You can still message them.
              </EmptyState>
            )}

            <div className="pf-buy-foot">
              <span className="pf-fine-line">
                <Icon d={ICONS.lock} size={16} />
                <span>
                  <b>Secure payment, every hour logged.</b> When {first} marks work complete, you have 48 hours to approve it or ask for one last call or revision.
                </span>
              </span>
              {!preview && <CompareToggle mentor={compareMe} label="Add to compare" />}
            </div>
          </div>
        </div>
      </section>

      <div className="pf-body">
        <div className="pf-wrap pf-main">
          <SectionNav sections={sections} />

          {body}

          {/* ---------- Reviews ---------- */}
          <section id="pf-reviews" className="pf-sec" aria-labelledby="reviews-title">
            <div className="row-wrap" style={{ alignItems: "baseline" }}>
              <h2 id="reviews-title">Reviews</h2>
              {avg !== null && <ReviewSummary avg={avg} count={reviewCount} />}
            </div>
            {reviewList}
          </section>
        </div>
      </div>

      {/* ---------- Pop-ups ---------- */}
      {/* Keyed by what it shows, so switching (e.g. Details -> intro call)
          moves keyboard focus into the new content. */}
      <Modal
        key={dialog ? (dialog.t === "details" ? `details-${dialog.offerId}` : dialog.t) : "closed"}
        open={dialog !== null}
        onClose={closeDialog}
        wide={dialog?.t !== "message"}
        booker={dialog?.t === "intro"}
        label={
          dialog?.t === "all"
            ? `${first}'s packages`
            : dialog?.t === "intro"
              ? "Book a free intro call"
              : dialog?.t === "message"
                ? `Message ${first}`
                : current
                  ? offerLabel(current)
                  : "Details"
        }
      >
        {dialog?.t === "all" && (
          <div className="stack">
            <h2 className="modal-title">Packages <span className="tab-count">{offers.packages.length}</span></h2>
            {offers.packages.map((p) => (
              <button
                key={p.id}
                type="button"
                className="pkg-line pkg-line-btn"
                onClick={() => setDialog({ t: "details", offerId: p.id, fromAll: true })}
              >
                <span className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
                  <b>{p.title}</b>
                  <span className="text-muted">About {hoursLabel(p.minutes)} · {labelFor(FORMATS, p.format)}</span>
                </span>
                <b className="nowrap">{money(p.price)} →</b>
              </button>
            ))}
          </div>
        )}
        {dialog?.t === "details" && current && (
          <OfferDetails
            offer={current}
            first={first}
            fromAll={!!dialog.fromAll}
            onBack={() => setDialog({ t: "all" })}
            isBuyer={isBuyer}
            loggedOut={status !== "loading" && !session}
            loginHref={loginHref}
            unlock={unlock}
            canBuy={canTakeStudents}
            blockedNote={blockedNote}
            preview={preview}
            onIntro={() => setDialog({ t: "intro" })}
            onMessage={() => setDialog({ t: "message" })}
          />
        )}
        {dialog?.t === "intro" && isBuyer && (
          <IntroCallPanel seller={seller} first={first} unlock={unlock} unlockError={unlockError} onChanged={loadUnlock} onMessage={() => setDialog({ t: "message" })} />
        )}
        {dialog?.t === "message" && isBuyer && (
          <MessagePanel sellerId={seller.id} first={first} unlock={unlock} blocked={blocked} onSent={loadUnlock} onOpenThread={(id) => router.push(`/messages/${id}`)} />
        )}
      </Modal>
      {!preview && <CompareTray />}
      {ask.dialog}
    </div>
  );
}

// The section menu at the top of the right column; the section on screen is
// underlined as you scroll.
function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [on, setOn] = useState(sections[0]?.id);
  const ids = sections.map((s) => s.id).join(",");
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(`pf-${s.id}`)).filter((x): x is HTMLElement => !!x);
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) if (en.isIntersecting) setOn(en.target.id.slice(3));
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  if (sections.length < 3) return null;
  return (
    <nav className="pf-secnav" aria-label="Profile sections">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#pf-${s.id}`}
          aria-current={on === s.id ? "true" : undefined}
          onClick={(e) => {
            const el = document.getElementById(`pf-${s.id}`);
            if (!el) return;
            e.preventDefault();
            el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
            setOn(s.id);
          }}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

// "★ 4.9 average · 12 reviews", counting up the first time it scrolls into view.
function ReviewSummary({ avg, count }: { avg: number; count: number }) {
  const [ref, t] = useCountUp<HTMLSpanElement>();
  return (
    <span ref={ref} className="text-secondary">
      ★ <CountText text={avg.toFixed(1)} t={t} /> average · <CountText text={String(count)} t={t} /> {count === 1 ? "review" : "reviews"}
    </span>
  );
}

// ---------------- Unlock note (side box) ----------------

function UnlockNote({ unlock, first }: { unlock: Unlock; first: string }) {
  if (unlock.unlocked) {
    return (
      <span className="alert alert-success small">
        <b>Unlocked.</b> You can buy hours and packages from {first}.
      </span>
    );
  }
  const intro = unlock.introCall;
  return (
    <span className="text-muted small">
      {intro && intro.status === "BOOKED"
        ? `Intro call booked for ${fmtWhen(intro.startTime)}. Buying unlocks once it's held, or when ${first} replies to a message.`
        : unlock.messaged
          ? `Waiting for ${first} to reply. Buying unlocks once they do, or after an intro call.`
          : `Buying unlocks once ${first} replies to a message, or after your intro call.`}
    </span>
  );
}

// ---------------- Details pop-up ----------------

function OfferDetails({
  offer,
  first,
  fromAll,
  onBack,
  isBuyer,
  loggedOut,
  loginHref,
  unlock,
  canBuy,
  blockedNote,
  preview,
  onIntro,
  onMessage,
}: {
  offer: PublicOffer;
  first: string;
  fromAll: boolean;
  onBack: () => void;
  isBuyer: boolean;
  loggedOut: boolean;
  loginHref: string;
  unlock: Unlock | null;
  canBuy: boolean;
  blockedNote?: string;
  preview: boolean;
  onIntro: () => void;
  onMessage: () => void;
}) {
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [credit, setCredit] = useState(0);
  const unlocked = !!unlock?.unlocked;
  // MentorsMD credit is applied first at checkout.
  useEffect(() => {
    if (!isBuyer) return;
    fetch("/api/me/credit").then((r) => r.json()).then((d) => setCredit(d.balanceCents || 0)).catch(() => {});
  }, [isBuyer]);
  // The same split checkout makes (at least 50 cents goes on the card when
  // credit doesn't cover everything).
  const creditUsed = splitCredit(offer.price || 0, credit).creditCents;

  async function buy() {
    setBuying(true);
    setError("");
    try {
      const res = await fetch("/api/checkout/offer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gigId: offer.id }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) {
        window.location.href = d.url; // Stripe Checkout
        return;
      }
      setError(d.error || "Couldn't start checkout. Please try again.");
    } catch {
      setError("Couldn't start checkout. Please try again.");
    }
    setBuying(false);
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {fromAll && <button type="button" className="modal-back" onClick={onBack}>← All packages</button>}
      {offer.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={stripFocus(offer.coverUrl)} alt="" className="pf-offer-cover" width={640} height={160} decoding="async" style={{ objectPosition: focusPosition(offer.coverUrl) }} />
      )}
      <div className="stack-sm">
        <h2 className="modal-title">{offer.kind === "HOURLY" ? `1 hour with ${first}` : offerLabel(offer)}</h2>
        <div className="pkg-meta">
          <span className="badge">{offer.kind === "SPECIALIZED" ? `About ${hoursLabel(offer.minutes)}` : hoursLabel(offer.minutes)}</span>
          <span className="badge badge-blue">{labelFor(FORMATS, offer.format) || "Calls + written"}</span>
          {offer.service && <span className="badge badge-brand">{serviceLabel(offer.service, offer.serviceOther)}</span>}
          <span className="badge">Due date: none</span>
        </div>
      </div>
      <p className="text-secondary" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{offer.description}</p>
      <div className="alert alert-blue stack-sm">
        <b>Price: {priceMath(offer.minutes, offer.rateCents)}</b>
        {creditUsed > 0 && (
          <span className="small">
            Credit applied: <b>{money(creditUsed)}</b>. {creditUsed >= offer.price ? "Nothing to pay by card." : `You pay ${money(offer.price - creditUsed)} by card.`}
          </span>
        )}
        <span className="small">
          How hours work: book 30- or 60-minute calls on {first}&apos;s calendar, or send work for written feedback; each is logged in 30- or 60-minute blocks you can see.
          {offer.kind === "SPECIALIZED" ? " The hours are an estimate: if it takes longer, you add hours at the same rate." : " Add more hours any time."}{" "}
          If you finish early, unused hours aren&apos;t refunded: packages are priced on an estimate, and mentors aren&apos;t penalised for working efficiently. When {first} marks the work complete you have 48 hours to approve, or ask for one last call or revision.
        </span>
      </div>

      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      {preview ? (
        <div className="stack-sm">
          {offer.hiddenFromStudents && <NotVisibleTag />}
          <PreviewOnly>
            <button className="btn btn-primary btn-lg" disabled>Buy for {money(offer.price)}</button>
          </PreviewOnly>
          <span className="text-muted small">{STUDENTS_SEE}. They can buy once you reply to their message or after an intro call.</span>
        </div>
      ) : isBuyer ? (
        blockedNote ? (
          <span className="text-muted">{blockedNote}</span>
        ) : !canBuy ? (
          <span className="text-muted">{first} isn&apos;t taking new orders right now.</span>
        ) : unlocked ? (
          <button className="btn btn-primary btn-lg" style={{ alignSelf: "flex-start" }} disabled={buying} onClick={buy}>
            {buying ? "Opening checkout…" : creditUsed >= offer.price && creditUsed > 0 ? "Buy with credit" : `Buy for ${money(offer.price - creditUsed)}`}
          </button>
        ) : (
          <div className="stack-sm">
            <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled aria-describedby="locked-why">{LOCKED_TEXT}</button>
            <span id="locked-why" className="text-muted small">Buying unlocks once {first} replies to your message, or after your free intro call.</span>
            <div className="row-wrap">
              <button className="btn btn-soft" onClick={onIntro}>Book free intro call</button>
              <button className="btn" onClick={onMessage}>Message {first}</button>
            </div>
          </div>
        )
      ) : loggedOut ? (
        <Link href={loginHref} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Log in to buy</Link>
      ) : (
        <span className="text-muted">Only student accounts can buy.</span>
      )}
      {/* Parents: buy this exact offer for their student as a guest (/gift, lib/gifts.ts). */}
      {!preview && canBuy && (
        <span className="text-muted small">
          Buying for your student? <Link href={`/gift?offer=${encodeURIComponent(offer.id)}`} className="link">Buy it for them</Link>, no account needed.
        </span>
      )}
    </div>
  );
}

// ---------------- Intro call pop-up ----------------

function IntroCallPanel({ seller, first, unlock, unlockError, onChanged, onMessage }: { seller: any; first: string; unlock: Unlock | null; unlockError: boolean; onChanged: () => void; onMessage: () => void }) {
  const [booked, setBooked] = useState<{ startTime: string; id: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const intro = unlock?.introCall;
  const { confirm: confirmBox, dialog } = useConfirm();

  async function confirm(startIso: string): Promise<string | null> {
    const res = await fetch("/api/intro-calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mentorId: seller.id, startTime: startIso }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return d.error || "Couldn't book the call";
    setBooked({ startTime: d.booking.startTime, id: d.booking.id });
    onChanged();
    return null;
  }

  async function cancel() {
    if (!intro || !(await confirmBox({ title: "Cancel your intro call?", body: "You can book a new time afterwards.", confirmLabel: "Cancel the call", cancelLabel: "Keep it", danger: true }))) return;
    setCancelling(true);
    setError("");
    const res = await fetch(`/api/intro-calls/${intro.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    setCancelling(false);
    if (!res.ok) return setError(d.error || "Couldn't cancel the call");
    onChanged();
  }

  const header = (
    <div className="stack-sm">
      <h2 className="modal-title">Free {INTRO_CALL_MINUTES}-minute intro call with {first}</h2>
      <span className="text-secondary">{INTRO_TEXT}</span>
    </div>
  );

  if (booked) {
    return (
      <div className="stack">
        {header}
        <div className="alert alert-success stack-sm" role="status">
          <b>Booked: {fmtWhen(booked.startTime)}</b>
          <span>We emailed you and {first} a calendar invite. Join from the call page; the Join button opens 10 minutes before the start.</span>
        </div>
        <div className="row-wrap">
          <Link href={`/calls/${booked.id}`} className="btn btn-primary">Open the call page</Link>
          <button className="btn" onClick={onMessage}>Message {first}</button>
        </div>
      </div>
    );
  }

  if (!unlock) {
    return (
      <div className="stack">
        {header}
        {unlockError ? <div className="alert alert-danger">Couldn't load intro call times. Refresh the page to try again.</div> : <p className="text-muted">Loading…</p>}
      </div>
    );
  }

  if (intro) {
    const held = intro.outcome === "HELD";
    const upcoming = intro.status === "BOOKED" && new Date(intro.endTime).getTime() > Date.now();
    return (
      <div className="stack">
        {dialog}
        {header}
        {upcoming ? (
          <div className="alert alert-blue stack-sm">
            <b>Your intro call: {fmtWhen(intro.startTime)}</b>
            <span>Join from the call page; the Join button opens 10 minutes before the start.</span>
          </div>
        ) : (
          <div className="alert stack-sm">
            <b>{held ? `You've had your intro call with ${first}.` : `Your intro call with ${first} has ended.`}</b>
            <span>{held ? "You can now buy hours and packages." : `If something went wrong, message ${first} or contact us.`}</span>
          </div>
        )}
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <div className="row-wrap">
          {upcoming && <Link href={`/calls/${intro.id}`} className="btn btn-primary">Open the call page</Link>}
          {intro.canCancel && <button className="btn btn-danger" disabled={cancelling} onClick={cancel}>{cancelling ? "Cancelling…" : "Cancel the call"}</button>}
          <button className="btn" onClick={onMessage}>Message {first}</button>
        </div>
      </div>
    );
  }

  if (!unlock.canBookIntro) {
    return (
      <div className="stack">
        {header}
        <div className="alert alert-warning">{unlock.introBlockedReason || "You can't book an intro call with this mentor right now."}</div>
      </div>
    );
  }

  return (
    <Booker
      slotsUrl={`/api/mentors/${seller.id}/intro-slots`}
      mentor={{ id: seller.id, name: seller.name, photoUrl: seller.photoUrl }}
      title="Free intro call"
      durationMinutes={INTRO_CALL_MINUTES}
      description={INTRO_TEXT}
      details={<AboutYouNudge />}
      confirmLabel="Confirm"
      onConfirm={confirm}
      onMessage={onMessage}
      emptyHint={`Send ${first} a message instead.`}
    />
  );
}

// ---------------- Message pop-up ----------------

function MessagePanel({
  sellerId,
  first,
  unlock,
  blocked,
  onSent,
  onOpenThread,
}: {
  sellerId: string;
  first: string;
  unlock: Unlock | null;
  blocked: { iBlocked: boolean; theyBlocked: boolean } | null;
  onSent: () => void;
  onOpenThread: (conversationId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [warnings, setWarnings] = useState<SendWarning[] | null>(null);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Goes through the normal messages API, so every safety check applies
  // (word filter, off-site contact, rate limits, blocks, email confirmation).
  async function send(acknowledgeWarnings = false) {
    if (!draft.trim()) return;
    setSending(true);
    setError("");
    try {
      let conversationId = unlock?.conversationId || null;
      if (!conversationId) {
        const res = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sellerId }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't start the conversation");
        conversationId = data.conversation.id as string;
      }
      const sent = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft, acknowledgeWarnings }),
      });
      const d = await sent.json().catch(() => ({}));
      if (!sent.ok) {
        if (d.code === "WARNING") {
          setWarnings(d.warnings || []);
          return;
        }
        if (d.code === "EMAIL_UNVERIFIED") {
          setNeedsEmail(true);
          return;
        }
        throw new Error(d.error || "Message failed to send");
      }
      setWarnings(null);
      setDraft("");
      setSentTo(conversationId);
      onSent();
    } catch (e: any) {
      setError(e.message || "Message failed to send");
    } finally {
      setSending(false);
    }
  }

  if (blocked?.iBlocked || blocked?.theyBlocked) {
    return (
      <div className="stack">
        <h2 className="modal-title">Message {first}</h2>
        <span className="text-secondary">{blocked.iBlocked ? `You blocked ${first}. Unblock them to send a message.` : `You can't message ${first}.`}</span>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="stack">
        <h2 className="modal-title">Message sent</h2>
        <div className="alert alert-success" role="status">{first} gets an email about it. You&apos;ll see the reply in Messages.</div>
        <div className="row-wrap">
          <button className="btn btn-primary" onClick={() => onOpenThread(sentTo)}>Open the conversation</button>
          <button className="btn" onClick={() => setSentTo(null)}>Send another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="stack-sm">
        <h2 className="modal-title">Message {first}</h2>
        <span className="text-secondary">Ask anything before you buy. Messaging is free. Buying unlocks once {first} replies.</span>
      </div>
      <label className="field" style={{ marginBottom: 0 }}>
        <span className="sr-only">Your message</span>
        <textarea
          className="input ph-no-capture"
          style={{ minHeight: 140 }}
          maxLength={5000}
          placeholder={`Hi ${first}, I'm applying this cycle and would love help with…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <AboutYouNudge />
      {warnings && <SendWarnings warnings={warnings} busy={sending} onEdit={() => setWarnings(null)} onSendAnyway={() => send(true)} />}
      {needsEmail && <ConfirmEmailNotice />}
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={sending || !draft.trim()} onClick={() => send()}>
        {sending ? "Sending…" : "Send message"}
      </button>
    </div>
  );
}
