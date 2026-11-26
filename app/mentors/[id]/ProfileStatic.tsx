// The parts of a mentor's profile that never change while the page is open
// (About, Known for, Specialties, Admissions experience, Credentials,
// Clinical & research, Languages, Fun fact, and the reviews list). They are
// rendered on the server and handed to ProfileClient, so the browser only
// runs code for the buttons and pop-ups. No hooks here.
import { Collapsible, EmptyState, Stars } from "@/components/ui";
import { ClientSchools } from "@/components/SchoolLogo";
import { ADMISSIONS_ROLE_TYPES, LANGUAGE_LEVELS, STRONGEST_STAGES, labelFor } from "@/lib/options";
import { fmtMonth } from "@/lib/format";
import type { LogoMap } from "@/lib/schoolLogoKey";
import { profileBasics } from "./profileData";

type OffersLike = { packages: { service: string | null }[] };

// How many reviews show before "Show all reviews".
const REVIEWS_SHOWN = 4;

// Long text: the first part, with "Read more" for the rest. Splits between
// paragraphs where it can, otherwise at a word near `limit` characters.
function LongText({ text, className, limit = 600 }: { text: string; className?: string; limit?: number }) {
  const clean = text.trim();
  const paras = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  let head = "";
  let rest = "";
  if (clean.length <= limit + 150 && paras.length <= 1) {
    head = clean;
  } else if (paras.length > 1) {
    // Whole paragraphs up to the limit (always at least the first).
    let n = 1;
    let len = paras[0].length;
    while (n < paras.length && len + paras[n].length <= limit) len += paras[n++].length;
    head = paras.slice(0, n).join("\n\n");
    rest = paras.slice(n).join("\n\n");
  } else {
    const cut = clean.lastIndexOf(" ", limit);
    const at = cut > limit / 2 ? cut : limit;
    head = `${clean.slice(0, at).trimEnd()}…`;
    rest = `…${clean.slice(at).trimStart()}`;
  }
  return (
    <div className="stack-sm">
      <p className={className}>{head}</p>
      {rest && (
        <Collapsible variant="inline" title="Read more">
          <p className={className}>{rest}</p>
        </Collapsible>
      )}
    </div>
  );
}

export function ProfileBody({ seller, offers, reviews, logos = {} }: { seller: any; offers: OffersLike; reviews: { rating: number }[]; logos?: LogoMap }) {
  const { first, bestFor, clientSchools, specialties, roles, highlights, knownFor, languages, facts } = profileBasics(seller, offers, reviews);
  const stages: string[] = (seller.strongestStages || []).map((s: string) => labelFor(STRONGEST_STAGES, s));
  const experience = [
    ...roles.map((r) => ({ title: `${labelFor(ADMISSIONS_ROLE_TYPES, r.type)}${r.former ? " (former)" : ""}`, sub: [r.place, r.years].filter(Boolean).join(" · ") })),
    ...(typeof seller.yearsAdvising === "number" ? [{ title: `${seller.yearsAdvising} ${seller.yearsAdvising === 1 ? "year" : "years"} advising applicants`, sub: "" }] : []),
    ...(typeof seller.applicantsSupported === "number" ? [{ title: `About ${seller.applicantsSupported} applicants supported`, sub: "" }] : []),
  ];
  const showAbout = !!(seller.bio || facts.length || clientSchools.length);
  return (
    <>
      {showAbout && (
        <section id="pf-about" className="pf-sec" aria-labelledby="about-title">
          <span className="eyebrow">About {first}</span>
          {knownFor[0] ? (
            <h2 id="about-title" className="pf-lead-title">{knownFor[0]}<span className="pf-dot">.</span></h2>
          ) : (
            <h2 id="about-title" className="sr-only">About {first}</h2>
          )}
          {seller.bio && <LongText text={seller.bio} className="pf-bio" limit={900} />}
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
            <p className="text-secondary">
              <b className="pf-strong">Strongest at:</b> {stages.join(", ")}
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
                <span className="pf-pre">{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(seller.specialtyInterest || seller.researchSummary) && (
        <section id="pf-research" className="pf-sec" aria-labelledby="clinical-title">
          <h2 id="clinical-title">Clinical &amp; research</h2>
          {seller.specialtyInterest && <span className="pf-interest">Specialty interest: {seller.specialtyInterest}</span>}
          {seller.researchSummary && <LongText text={seller.researchSummary} className="text-secondary pf-longtext" />}
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

type ReviewItem = { id: string; author: string; rating: number; createdAt: string | Date; bought?: string | null; comment?: string | null };

function ReviewCard({ r }: { r: ReviewItem }) {
  return (
    <div className="card stack-sm">
      <div className="between">
        <b>{r.author}</b>
        <span className="text-muted">{fmtMonth(r.createdAt, { timeZone: "UTC" })}</span>
      </div>
      <Stars value={r.rating} showValue={false} />
      {r.bought && <span className="text-muted small">Bought: {r.bought}</span>}
      {r.comment && <p className="pf-review-text">{r.comment}</p>}
    </div>
  );
}

// The reviews list: the newest few, then "Show all reviews" for the rest.
export function ReviewList({ reviews, first }: { reviews: ReviewItem[]; first: string }) {
  if (reviews.length === 0) return <EmptyState title="No reviews yet">{first} is new to MentorsMD.</EmptyState>;
  const shown = reviews.slice(0, REVIEWS_SHOWN);
  const rest = reviews.slice(REVIEWS_SHOWN);
  return (
    <>
      {shown.map((r) => <ReviewCard key={r.id} r={r} />)}
      {rest.length > 0 && (
        <Collapsible variant="row" title="Show all reviews" count={reviews.length} bodyClassName="stack">
          {rest.map((r) => <ReviewCard key={r.id} r={r} />)}
        </Collapsible>
      )}
    </>
  );
}
