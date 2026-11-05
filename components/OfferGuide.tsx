"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";
import { FORMATS, PACKAGE_MAX_MINUTES, PACKAGE_MIN_MINUTES, labelFor, money } from "@/lib/options";
import { hoursLabel, priceFor, priceMath } from "@/lib/pricing";
import type { PageValues } from "@/lib/siteContent";

// "How To Set Up Your Offers": a pop-up for mentors with example packages,
// how to use hourly work, and freelancing notes. The wording is in Admin ->
// Website -> Offer guide (defaults: lib/offerGuideContent.ts), loaded when
// it's first opened (/api/offers/guide). Prices are worked out from the
// mentor's own rate, or a labeled example rate before they've set one.

export type GuideValues = PageValues<"mentorGuide">;
export type GuideTab = "packages" | "hourly" | "notes";

const TABS: { value: GuideTab; label: string }[] = [
  { value: "packages", label: "Package Examples" },
  { value: "hourly", label: "Hourly & Bundles" },
  { value: "notes", label: "Freelancing Notes" },
];

// Picked for easy math. Only used before the mentor has set a rate, and
// always labeled as an example.
const EXAMPLE_RATE_CENTS = 10_000;

// Minutes for an example's "Estimated hours", or null if it doesn't fit the
// package rules (an admin can type anything there).
function exampleMinutes(hours: string) {
  const minutes = Math.round(Number(hours) * 60);
  return hours.trim() && Number.isFinite(minutes) && minutes % 30 === 0 && minutes >= PACKAGE_MIN_MINUTES && minutes <= PACKAGE_MAX_MINUTES ? minutes : null;
}

function Points({ items }: { items: string[] }) {
  return (
    <ul className="offer-guide-list">
      {items.map((p) => <li key={p}>{p}</li>)}
    </ul>
  );
}

export function OfferGuideBody({ values, rateCents, tab, onTab }: { values: GuideValues; rateCents?: number | null; tab: GuideTab; onTab: (t: GuideTab) => void }) {
  const rate = rateCents || EXAMPLE_RATE_CENTS;
  const rateNote = rateCents
    ? `Example prices below use your rate of ${money(rateCents)} an hour.`
    : `Prices below use an example rate of ${money(EXAMPLE_RATE_CENTS)} an hour, picked for easy math. It isn't a suggested rate.`;
  const packagePrice = priceFor(360, rate);
  const fee = Math.round((packagePrice * PLATFORM_FEE_PERCENT) / 100);

  return (
    <div className="stack offer-guide">
      <div className="stack-sm">
        <h2 style={{ fontSize: 28, paddingRight: 36 }}>{values.title}</h2>
        <span className="text-secondary">{values.intro}</span>
      </div>

      <div className="seg" role="group" aria-label="Guide sections">
        {TABS.map((t) => (
          <button type="button" key={t.value} className="seg-opt" aria-pressed={tab === t.value} onClick={() => onTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "packages" && (
        <div className="stack">
          <span className="text-secondary">{values.packagesIntro}</span>
          <div className="alert alert-blue small">{rateNote}</div>
          {values.packageExamples.map((ex) => {
            const minutes = exampleMinutes(ex.hours);
            return (
              <div key={ex.title} className="pkg-card">
                <b style={{ fontSize: 18 }}>{ex.title}</b>
                <div className="pkg-meta">
                  <span className="badge">Example</span>
                  <span className="badge badge-blue">{labelFor(FORMATS, ex.format)}</span>
                  {minutes && <span className="badge">About {hoursLabel(minutes)}</span>}
                  {ex.topic && <span className="badge badge-brand">{ex.topic}</span>}
                </div>
                <span className="text-secondary">{ex.included}</span>
                {minutes && <span className="small"><b>Example price:</b> {priceMath(minutes, rate)}</span>}
                {ex.note && <span className="text-muted small">{ex.note}</span>}
              </div>
            );
          })}
          <div className="stack-sm">
            <h3 className="offer-guide-head">How Packages Work</h3>
            <Points items={values.packageRules} />
          </div>
        </div>
      )}

      {tab === "hourly" && (
        <div className="stack">
          <span className="text-secondary">{values.hourlyIntro}</span>
          {values.hourlyOptions.map((o) => (
            <div key={o.name} className="pkg-card">
              <b style={{ fontSize: 18 }}>{o.name}</b>
              <span className="text-secondary">{o.what}</span>
              {o.fits.length > 0 && (
                <div className="stack-sm">
                  <b className="small">When It Fits</b>
                  <Points items={o.fits} />
                </div>
              )}
            </div>
          ))}
          <div className="alert alert-blue stack-sm small">
            <b>The Math, As An Example</b>
            <span>{rateNote}</span>
            <span>Single hour: {priceMath(60, rate)}</span>
            <span>Bundle: {priceMath(180, rate)}</span>
            <span>Bundle: {priceMath(600, rate)}</span>
          </div>
          <div className="stack-sm">
            <h3 className="offer-guide-head">Good To Know</h3>
            <Points items={values.hourlyNotes} />
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div className="stack">
          <span className="text-secondary">{values.notesIntro}</span>
          {values.noteGroups.map((g) => (
            <div key={g.title} className="stack-sm">
              <h3 className="offer-guide-head">{g.title}</h3>
              <Points items={g.points} />
            </div>
          ))}
          <div className="alert alert-blue stack-sm small">
            <b>The Split, As An Example</b>
            <span>{rateNote}</span>
            <span>A package of {priceMath(360, rate)}. You earn {money(packagePrice - fee)} ({100 - PLATFORM_FEE_PERCENT}%) and MentorsMD keeps {money(fee)} ({PLATFORM_FEE_PERCENT}%).</span>
          </div>
        </div>
      )}
    </div>
  );
}

// A tab switcher around the body, for the admin preview page.
export function OfferGuideStatic({ values }: { values: GuideValues }) {
  const [tab, setTab] = useState<GuideTab>("packages");
  return <OfferGuideBody values={values} tab={tab} onTab={setTab} />;
}

// The button (or link) that opens the pop-up. `tab` picks where it opens.
export function OfferGuideButton({ rateCents, tab = "packages", className = "btn btn-sm", children }: { rateCents?: number | null; tab?: GuideTab; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<GuideValues | null>(null);
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState<GuideTab>(tab);

  function load() {
    setFailed(false);
    fetch("/api/offers/guide")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setValues(d.guide))
      .catch(() => setFailed(true));
  }

  function show() {
    setCurrent(tab);
    setOpen(true);
    if (!values) load();
  }

  return (
    <>
      <button type="button" className={className} onClick={show}>{children}</button>
      <Modal open={open} onClose={() => setOpen(false)} label="How to set up your offers" wide resetKey={`${current}${values ? 1 : 0}`}>
        {values ? (
          <OfferGuideBody values={values} rateCents={rateCents} tab={current} onTab={setCurrent} />
        ) : failed ? (
          <div className="stack" style={{ paddingRight: 36 }}>
            <div role="alert" className="alert alert-danger">Couldn&apos;t load the guide.</div>
            <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={load}>Try again</button>
          </div>
        ) : (
          <span className="text-muted">Loading…</span>
        )}
      </Modal>
    </>
  );
}
