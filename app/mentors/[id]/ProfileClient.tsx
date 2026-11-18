"use client";

import { useCallback, useEffect, useState } from "react";
import { CompareToggle, CompareTray, compareSnapshot, useCompare } from "@/components/Compare";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon, ICONS, Rating, tintFor, initialsOf } from "@/components/ui";
import { StarsFill } from "@/components/Moments";
import { MOMENTS } from "@/lib/moments";
import { SchoolLogo, ClientSchools } from "@/components/SchoolLogo";
import type { LogoMap } from "@/lib/schoolLogoKey";
import { Modal } from "@/components/Modal";
import { Rail } from "@/components/Rail";
import { CountText, useCountUp } from "@/components/CountUp";
import { Booker } from "@/components/Booker";
import { AboutYouNudge } from "@/components/AboutYouNudge";
import { ConfirmEmailNotice, ReportDialog, SendWarnings, setBlocked, type SendWarning } from "@/components/Safety";
import { trackEvent } from "@/components/Tracker";
import {
  ADMISSIONS_ROLE_TYPES,
  BEST_FOR,
  FORMATS,
  INTRO_CALL_MINUTES,
  LANGUAGE_LEVELS,
  SCHOOL_TYPES,
  credentialLine,
  mentorRank,
  mentorSchoolName,
  mentorStageTag,
  specialtiesOf,
  STRONGEST_STAGES,
  labelFor,
  money,
  serviceLabel,
} from "@/lib/options";
import { hoursLabel, priceMath } from "@/lib/pricing";
import { splitCredit } from "@/lib/hours";
import { focusPosition, stripFocus } from "@/lib/imageFocus";
import type { AdmissionsRole, Language } from "@/lib/profileCompleteness";
import { useAdminDialog } from "@/components/admin/AdminDialog";

// A mentor's public profile (docs/redesign-2026-10.md sections 1 and 2,
// laid out Leland-style in Nov 2026). Left: photo, name, credential, school
// with its logo and the full rank, "students got into" logos, quick facts,
// then labelled sections (About, Specialties, Admissions experience, Known
// for, Credentials, Clinical & research, Languages, Fun fact), the packages
// row, "Buy hours" (1 hour or a bundle) and reviews. Right: Book a free
// 15-minute intro call / Message. Every Details / Buy /
// intro call / message action opens as a pop-up here, never a new page.

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

const LOCKED_TEXT = "Message or book an intro call to unlock";

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

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

export function ProfileClient({ seller, offers, reviews, previewState = null, logos = {} }: { seller: any; offers: Offers; reviews: any[]; previewState?: PreviewState; logos?: LogoMap }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = (session?.user as any)?.role;
  const isBuyer = role === "BUYER";
  const isSelf = (session?.user as any)?.id === seller.id;
  const preview = isSelf && previewState !== null;
  const first = seller.name.split(" ")[0];
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/mentors/${seller.id}`)}`;

  const [unlock, setUnlock] = useState<Unlock | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pickedHours, setPickedHours] = useState<string | null>(offers.hourly?.id || offers.bundles[0]?.id || null); // the first option shown (1 hour)
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlockedState] = useState<{ iBlocked: boolean; theyBlocked: boolean } | null>(null);

  const allOffers = [...(offers.hourly ? [offers.hourly] : []), ...offers.bundles, ...offers.packages];
  const canTakeStudents = seller.listed && !seller.adultsOnlyForViewer;

  const loadUnlock = useCallback(() => {
    if (!isBuyer) return;
    fetch(`/api/mentors/${seller.id}/unlock`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUnlock(d))
      .catch(() => {});
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

  async function toggleBlock(block: boolean) {
    if (block && !confirm(`Block ${seller.name}? Neither of you will be able to message the other.`)) return;
    try {
      await setBlocked(seller.id, block);
      setBlockedState({ iBlocked: block, theyBlocked: blocked?.theyBlocked || false });
    } catch (e: any) {
      alert(e.message);
    }
  }

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const bestFor: string[] = [...(seller.bestFor || []).map((b: string) => labelFor(BEST_FOR, b)), ...(seller.bestForOther ? [seller.bestForOther] : [])];
  const closeDialog = () => setDialog(null);
  const current = dialog?.t === "details" ? allOffers.find((o) => o.id === dialog.offerId) : null;
  const school = mentorSchoolName(seller);
  const rank = mentorRank(seller.mentorStage) || mentorStageTag(seller.mentorStage);
  const clientSchools: string[] = seller.clientSchools || [];
  const specialties = specialtiesOf(seller.strongestStages, offers.packages.map((p) => p.service));
  const roles: AdmissionsRole[] = seller.admissionsRoles || [];
  // The quick facts under the header.
  const facts: { value: string; label: string }[] = [
    ...(typeof seller.yearsAdvising === "number" && seller.yearsAdvising > 0 ? [{ value: `${seller.yearsAdvising}+`, label: seller.yearsAdvising === 1 ? "year advising" : "years advising" }] : []),
    ...(typeof seller.applicantsSupported === "number" && seller.applicantsSupported > 0 ? [{ value: `${seller.applicantsSupported}+`, label: "applicants helped" }] : []),
    ...(roles.length > 0 ? [{ value: String(roles.length), label: roles.length === 1 ? "admissions role" : "admissions roles" }] : []),
    ...(clientSchools.length > 0 ? [{ value: String(clientSchools.length), label: clientSchools.length === 1 ? "school students got into" : "schools students got into" }] : []),
    ...(reviews.length > 0 && avg !== null ? [{ value: `${avg.toFixed(1)}★`, label: `${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}` }] : []),
  ].slice(0, 4);
  // "Buy hours": 1 hour, then each bundle.
  const hourOptions = [...(offers.hourly ? [offers.hourly] : []), ...offers.bundles];

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
    reviewCount: reviews.length,
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

  // The two main actions, used in the side box.
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
        <button className={`btn btn-primary ${stack ? "btn-block" : ""}${MOMENTS.profileStars ? " mm-glow-once" : ""}`} disabled={!canTakeStudents} onClick={() => setDialog({ t: "intro" })} aria-haspopup="dialog">
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
  const highlights: string[] = seller.highlights || [];
  const knownFor: string[] = seller.knownFor || [];
  const languages: Language[] = seller.languages || [];
  const sections: { id: string; label: string }[] = [
    ...(seller.bio || facts.length || clientSchools.length ? [{ id: "about", label: "About" }] : []),
    ...(knownFor.length ? [{ id: "known", label: "Known for" }] : []),
    ...(specialties.length || bestFor.length ? [{ id: "specialties", label: "Specialties" }] : []),
    ...(roles.length || (seller.strongestStages || []).length || typeof seller.yearsAdvising === "number" || typeof seller.applicantsSupported === "number" ? [{ id: "experience", label: "Experience" }] : []),
    ...(highlights.length ? [{ id: "credentials", label: "Credentials" }] : []),
    ...(seller.specialtyInterest || seller.researchSummary ? [{ id: "research", label: "Research" }] : []),
    ...(languages.length || seller.funFact ? [{ id: "more", label: languages.length && seller.funFact ? "Languages & fun fact" : languages.length ? "Languages" : "Fun fact" }] : []),
    ...(offers.packages.length ? [{ id: "packages", label: "Packages" }] : []),
    { id: "reviews", label: "Reviews" },
  ];

  return (
    <div className="pf">
      <section className="pf-hero">
        <div className="blob" style={{ left: -120, top: 10, width: 520, height: 260, background: "rgba(228,238,255,0.9)", filter: "blur(50px)" }} />
        <div className="blob" style={{ right: -80, top: -60, width: 560, height: 300, background: "rgba(245,185,205,0.45)", filter: "blur(60px)" }} />
        <div className="blob" style={{ left: "35%", top: -80, width: 520, height: 200, background: "rgba(207,196,255,0.45)", filter: "blur(60px)" }} />
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

      <div className="pf-body">
        <div className="pf-wrap pf-grid">
          {/* ---------- Sticky sidebar (Nov 2026) ----------
              Photo, name, school, who they're best for, rate and hours,
              and the two main actions; stays on screen while the profile
              scrolls on the right. */}
          <aside className="pf-side">
            <div className="pf-card">
              <div className="pf-photo">
                {seller.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seller.photoUrl} alt={seller.name} />
                ) : (
                  <span className="avatar" style={{ background: tintFor(seller.id) }}>{initialsOf(seller.name)}</span>
                )}
              </div>
              <div className="pf-info">
                <div className="between" style={{ alignItems: "flex-start", gap: 10 }}>
                  <h1 className="pf-name">{seller.name}</h1>
                  {reviews.length === 0 && <span className="badge badge-brand" style={{ marginTop: 6 }}>New</span>}
                </div>
                {credentialLine(seller.credential, seller.mentorStage) && <span className="pf-cred">{credentialLine(seller.credential, seller.mentorStage)}</span>}
                {(school || rank) && (
                  <span className="school-line small">
                    {school && <SchoolLogo name={school} logos={logos} size={30} title={false} />}
                    <span className="stack-sm" style={{ gap: 0 }}>
                      {school && <b>{school}</b>}
                      <span className="text-secondary">{[rank, labelFor(SCHOOL_TYPES, seller.schoolType)].filter(Boolean).join(" · ")}</span>
                    </span>
                  </span>
                )}
                {reviews.length > 0 && (MOMENTS.profileStars && avg !== null ? <StarsFill avg={avg} count={reviews.length} /> : <Rating avg={avg} count={reviews.length} />)}
                {bestFor.length > 0 && (
                  <div className="stack-sm" style={{ gap: 6 }}>
                    <span className="pf-label">Best for</span>
                    <div className="row-wrap" style={{ gap: 6 }}>
                      {bestFor.map((t) => <span key={t} className="badge">{t}</span>)}
                    </div>
                  </div>
                )}
              </div>

              {hourOptions.length > 0 && (
                <div className="pf-rate">
                  <div className="between" style={{ alignItems: "baseline" }}>
                    <span className="pf-rate-big">{offers.hourly ? money(offers.hourly.rateCents) : money(hourOptions[0].rateCents)}<small>/hr</small></span>
                    <span className="text-muted small">{hourOptions.length > 1 ? "Save with bundles" : "Calls and written work"}</span>
                  </div>
                  {hourOptions.length > 1 && (
                    <div className="pf-hours" role="radiogroup" aria-label="How many hours">
                      {hourOptions.map((o) => (
                        <label key={o.id} className={`pf-hour${pickedHours === o.id ? " is-on" : ""}`}>
                          <input type="radio" name="hours" value={o.id} checked={pickedHours === o.id} onChange={() => setPickedHours(o.id)} />
                          <b>{hoursLabel(o.minutes)}</b>
                          <span>{money(o.price)}</span>
                          <small>{money(o.rateCents)}/hr</small>
                          {o.hiddenFromStudents && <NotVisibleTag />}
                        </label>
                      ))}
                    </div>
                  )}
                  {preview ? (
                    <PreviewOnly block>
                      <button className="btn btn-block" disabled>Buy hours</button>
                    </PreviewOnly>
                  ) : (
                    <button className="btn btn-block" disabled={!pickedHours} onClick={() => pickedHours && setDialog({ t: "details", offerId: pickedHours })} aria-haspopup="dialog">
                      Buy {pickedHours ? hoursLabel(hourOptions.find((o) => o.id === pickedHours)?.minutes || 60) : "hours"}
                    </button>
                  )}
                </div>
              )}

              <div className="pf-actions">
                {!seller.listed && !isSelf && seller.available && <span className="text-muted small">{first} isn&apos;t taking new students right now.</span>}
                {actions(true)}
                {isBuyer && unlock && <UnlockNote unlock={unlock} first={first} />}
                {!preview && <div style={{ display: "flex", justifyContent: "center" }}><CompareToggle mentor={compareMe} label="Add to compare" /></div>}
              </div>

              <div className="pf-fine">
                <Icon d={ICONS.lock} size={18} />
                <span>
                  <b>Secure payment, every hour logged.</b> When {first} marks work complete, you have 48 hours to approve it or ask for one last call or revision.
                </span>
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
          </aside>

          <div className="pf-main">
            {!seller.available && (
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                <b>{first} is away{seller.pausedUntil ? ` until ${new Date(seller.pausedUntil).toLocaleDateString(undefined, { month: "long", day: "numeric" })}` : ""}.</b>{" "}
                {seller.status === "REMOVED" ? "This profile has been removed." : seller.awayNote || "New orders are paused for now."}
              </div>
            )}
            {seller.adultsOnlyForViewer && (
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                <b>{first} works with students 18 and over.</b> You can still read their profile, but you can&apos;t message or book them. Browse other mentors who work with students under 18.
              </div>
            )}

            <SectionNav sections={sections} />

            {sections.some((s) => s.id === "about") && (
              <section id="pf-about" className="pf-sec" aria-labelledby="about-title">
                <span className="eyebrow">About {first}</span>
                {knownFor[0] && <h2 id="about-title" className="pf-lead-title">{knownFor[0]}<span style={{ color: "var(--primary)" }}>.</span></h2>}
                {!knownFor[0] && <h2 id="about-title" className="sr-only">About {first}</h2>}
                {seller.bio && <p className="pf-bio">{seller.bio}</p>}
                {facts.length > 0 && (
                  <ul className="profile-facts">
                    {facts.map((f) => (
                      <li key={f.label}>
                        <b>{f.value}</b>
                        <span>{f.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {clientSchools.length > 0 && (
                  <div className="profile-panel">
                    <ClientSchools schools={clientSchools} logos={logos} size={44} label={`${first}'s students got into:`} />
                  </div>
                )}
              </section>
            )}

            {knownFor.length > 0 && (
              <section id="pf-known" className="pf-sec" aria-labelledby="known-title">
                <h2 id="known-title">What {first} is <em>known for</em></h2>
                <div className="pf-known">
                  {knownFor.map((t, i) => (
                    <div key={i}>
                      <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                      {t}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(specialties.length > 0 || bestFor.length > 0) && (
              <section id="pf-specialties" className="pf-sec" aria-labelledby="specialties-title">
                <h2 id="specialties-title">Specialties</h2>
                <div className="pf-two">
                  {specialties.length > 0 && (
                    <div className="stack-sm">
                      <span className="pf-label">What {first} helps with</span>
                      <div className="row-wrap" style={{ gap: 8 }}>
                        {specialties.map((t) => <span key={t} className="badge badge-brand badge-lg">{t}</span>)}
                      </div>
                    </div>
                  )}
                  {bestFor.length > 0 && (
                    <div className="stack-sm">
                      <span className="pf-label">Best for</span>
                      <div className="row-wrap" style={{ gap: 6 }}>
                        {bestFor.map((t) => <span key={t} className="badge badge-lg">{t}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            <ProfileSections seller={seller} first={first} />

            {/* ---------- Packages ---------- */}
            {offers.packages.length > 0 && (
              <section id="pf-packages" className="pf-sec" aria-labelledby="packages-title">
                <h2 id="packages-title">
                  <button type="button" className="link-btn" style={{ textDecoration: "none", font: "inherit", color: "inherit" }} onClick={() => setDialog({ t: "all" })} aria-haspopup="dialog">
                    Packages ({offers.packages.length}) <span aria-hidden="true" style={{ color: "var(--primary)" }}>→</span>
                  </button>
                </h2>
                <Rail className="pkg-row" label="Specialized packages">
                  {offers.packages.map((p) => (
                    <article key={p.id} className="pkg-tile" role="listitem">
                      <div className={`pkg-tile-cover ${p.coverUrl ? "has-photo" : ""}`}>
                        {p.coverUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={stripFocus(p.coverUrl)} alt="" loading="lazy" style={{ objectPosition: focusPosition(p.coverUrl) }} />
                        )}
                        <b>{p.title}</b>
                      </div>
                      <div className="pkg-tile-body">
                        {p.hiddenFromStudents && <NotVisibleTag />}
                        <span className="text-muted small">About {hoursLabel(p.minutes)} · {labelFor(FORMATS, p.format)}</span>
                        <span className="display" style={{ fontSize: 26 }}>{money(p.price)}</span>
                        <button className="btn btn-sm btn-soft" style={{ marginTop: "auto", alignSelf: "flex-start" }} onClick={() => setDialog({ t: "details", offerId: p.id })} aria-haspopup="dialog">
                          Details
                        </button>
                      </div>
                    </article>
                  ))}
                </Rail>
              </section>
            )}

            {allOffers.length === 0 && (
              <div className="empty" style={{ marginTop: 24 }}>
                {first} hasn&apos;t set up their hours yet. You can still message them.
                {preview && <> <Link href="/dashboard/packages" className="link">Set your rate</Link></>}
              </div>
            )}

            {/* ---------- Reviews ---------- */}
            <section id="pf-reviews" className="pf-sec" aria-labelledby="reviews-title">
              <div className="row-wrap" style={{ alignItems: "baseline" }}>
                <h2 id="reviews-title">Reviews</h2>
                {avg !== null && <ReviewSummary avg={avg} count={reviews.length} />}
              </div>
              {reviews.length === 0 && <div className="pf-noreviews"><b>No reviews yet</b><span>{first} is new to MentorsMD.</span></div>}
              {reviews.map((r) => (
                <div key={r.id} className="card stack-sm">
                  <div className="between">
                    <b>{r.author}</b>
                    <span className="text-muted">{new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
                  </div>
                  <span className="stars" aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  {r.bought && <span className="text-muted small">Bought: {r.bought}</span>}
                  {r.comment && <p style={{ lineHeight: 1.6 }}>{r.comment}</p>}
                </div>
              ))}
            </section>
          </div>
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
            <h2 style={{ fontSize: 26, paddingRight: 36 }}>Packages ({offers.packages.length})</h2>
            {offers.packages.map((p) => (
              <button
                key={p.id}
                type="button"
                className="pkg-line"
                style={{ border: "none", textAlign: "left", cursor: "pointer", width: "100%", font: "inherit", color: "inherit" }}
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
            preview={preview}
            onIntro={() => setDialog({ t: "intro" })}
            onMessage={() => setDialog({ t: "message" })}
          />
        )}
        {dialog?.t === "intro" && isBuyer && (
          <IntroCallPanel seller={seller} first={first} unlock={unlock} onChanged={loadUnlock} onMessage={() => setDialog({ t: "message" })} />
        )}
        {dialog?.t === "message" && isBuyer && (
          <MessagePanel sellerId={seller.id} first={first} unlock={unlock} blocked={blocked} onSent={loadUnlock} onOpenThread={(id) => router.push(`/messages/${id}`)} />
        )}
      </Modal>
      {!preview && <CompareTray />}
    </div>
  );
}

// ---------------- Profile sections ----------------
// The old "Read full bio" box, laid out as sections on the page (Nov 2026).

function ProfileSections({ seller, first }: { seller: any; first: string }) {
  const roles: AdmissionsRole[] = seller.admissionsRoles || [];
  const languages: Language[] = seller.languages || [];
  const stages: string[] = (seller.strongestStages || []).map((s: string) => labelFor(STRONGEST_STAGES, s));
  const experience = [
    ...roles.map((r) => ({ title: `${labelFor(ADMISSIONS_ROLE_TYPES, r.type)}${r.former ? " (former)" : ""}`, sub: [r.place, r.years].filter(Boolean).join(" · ") })),
    ...(typeof seller.yearsAdvising === "number" ? [{ title: `${seller.yearsAdvising} ${seller.yearsAdvising === 1 ? "year" : "years"} advising applicants`, sub: "" }] : []),
    ...(typeof seller.applicantsSupported === "number" ? [{ title: `About ${seller.applicantsSupported} applicants supported`, sub: "" }] : []),
  ];
  const highlights: string[] = seller.highlights || [];
  return (
    <>
      {(experience.length > 0 || stages.length > 0) && (
        <section id="pf-experience" className="pf-sec" aria-labelledby="experience-title">
          <h2 id="experience-title">Admissions experience</h2>
          {experience.length > 0 && (
            <ul className="profile-timeline">
              {experience.map((e, i) => (
                <li key={i}>
                  <b>{e.title}</b>
                  {e.sub && <span className="text-secondary">{e.sub}</span>}
                </li>
              ))}
            </ul>
          )}
          {stages.length > 0 && (
            <p className="text-secondary" style={{ marginTop: 4 }}>
              <b style={{ color: "var(--ink)" }}>Strongest at:</b> {stages.join(", ")}
            </p>
          )}
        </section>
      )}

      {highlights.length > 0 && (
        <section id="pf-credentials" className="pf-sec" aria-labelledby="highlights-title">
          <h2 id="highlights-title">Credentials &amp; <em>highlights</em></h2>
          <ul className="pf-creds">
            {highlights.map((t, i) => (
              <li key={i}>
                <span style={{ whiteSpace: "pre-wrap" }}>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(seller.specialtyInterest || seller.researchSummary) && (
        <section id="pf-research" className="pf-sec" aria-labelledby="clinical-title">
          <h2 id="clinical-title">Clinical &amp; research</h2>
          {seller.specialtyInterest && <span className="pf-interest">Specialty interest: {seller.specialtyInterest}</span>}
          {seller.researchSummary && <ReadMore text={seller.researchSummary} />}
        </section>
      )}

      {(languages.length > 0 || seller.funFact) && (
        <section id="pf-more" className="pf-sec" aria-label={languages.length && seller.funFact ? "Languages and fun fact" : languages.length ? "Languages" : "Fun fact"}>
          <div className="pf-two">
            {languages.length > 0 && (
              <div className="stack" style={{ gap: 12 }}>
                <h2>Languages</h2>
                <div className="row-wrap" style={{ gap: 10 }}>
                  {languages.map((l) => (
                    <span key={l.name} className="pf-lang">
                      <b>{l.name}</b>
                      <small>{labelFor(LANGUAGE_LEVELS, l.level)}{l.canAdvise ? " · can advise in it" : ""}</small>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {seller.funFact && (
              <div className="stack" style={{ gap: 12 }}>
                <h2>Fun fact</h2>
                <p className="pf-fun">{seller.funFact}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}

// Long text: the first paragraph, with "Read more" for the rest.
function ReadMore({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const long = paras.length > 1 || text.length > 700;
  const shown = open || !long ? text : paras.length > 1 ? paras[0] : `${text.slice(0, 600).trimEnd()}…`;
  return (
    <div className="stack-sm">
      <p className="text-secondary" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{shown}</p>
      {long && (
        <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Show less" : "Read more"}
        </button>
      )}
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
        <img src={stripFocus(offer.coverUrl)} alt="" style={{ width: "100%", height: 160, objectFit: "cover", objectPosition: focusPosition(offer.coverUrl), borderRadius: 12 }} />
      )}
      <div className="stack-sm" style={{ paddingRight: 36 }}>
        <h2 style={{ fontSize: 26 }}>{offer.kind === "HOURLY" ? `1 hour with ${first}` : offerLabel(offer)}</h2>
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
        !canBuy ? (
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

function IntroCallPanel({ seller, first, unlock, onChanged, onMessage }: { seller: any; first: string; unlock: Unlock | null; onChanged: () => void; onMessage: () => void }) {
  const [booked, setBooked] = useState<{ startTime: string; id: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const intro = unlock?.introCall;
  const { confirm: confirmBox, dialog } = useAdminDialog();

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
    <div className="stack-sm" style={{ paddingRight: 36 }}>
      <h2 style={{ fontSize: 26 }}>Free {INTRO_CALL_MINUTES}-minute intro call with {first}</h2>
      <span className="text-secondary">Say hello, talk through where you are in your application, and see if you&apos;re a good fit. There&apos;s nothing to pay. One intro call per mentor.</span>
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
        <p className="text-muted">Loading…</p>
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
      description={<>Say hello, talk through where you are in your application, and see if you&apos;re a good fit. There&apos;s nothing to pay. One intro call per mentor.</>}
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
        <h2 style={{ fontSize: 24, paddingRight: 36 }}>Message {first}</h2>
        <span className="text-secondary">{blocked.iBlocked ? `You blocked ${first}. Unblock them to send a message.` : `You can't message ${first}.`}</span>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="stack">
        <h2 style={{ fontSize: 24, paddingRight: 36 }}>Message sent</h2>
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
      <div className="stack-sm" style={{ paddingRight: 36 }}>
        <h2 style={{ fontSize: 24 }}>Message {first}</h2>
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
