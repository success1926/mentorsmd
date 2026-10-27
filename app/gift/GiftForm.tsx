"use client";

import { useState } from "react";
import Link from "next/link";
import { Honeypot, useRecaptcha } from "@/components/FormGuards";
import { money } from "@/lib/options";
import { GIFT_MAX_CENTS, GIFT_MIN_CENTS, GIFT_NOTE_MAX, GIFT_PRESETS_CENTS, parseGiftDollars } from "@/lib/giftOptions";

export type GiftOffer = { id: string; title: string; mentorName: string; mentorId: string; hours: string; priceCents: number };

// The /gift form: the parent, the student, what to buy, then Stripe.
export function GiftForm({ offer }: { offer: GiftOffer | null }) {
  const recaptcha = useRecaptcha();
  const [f, setF] = useState({ parentName: "", parentEmail: "", studentName: "", studentEmail: "", note: "" });
  const [preset, setPreset] = useState<number | "custom">(GIFT_PRESETS_CENTS[0]);
  const [custom, setCustom] = useState("");
  const [under18, setUnder18] = useState<boolean | null>(null);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const amountCents = offer ? offer.priceCents : preset === "custom" ? parseGiftDollars(custom) : preset;
  const sameEmail = !!f.studentEmail.trim() && f.studentEmail.trim().toLowerCase() === f.parentEmail.trim().toLowerCase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sameEmail) return setError("Use your student's own email address, not yours: it's where they'll log in.");
    if (under18 === null) return setError("Tell us whether your student is under 18.");
    if (!offer && !amountCents) return setError(`Pick an amount between ${money(GIFT_MIN_CENTS)} and ${money(GIFT_MAX_CENTS)} (whole dollars).`);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gift/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          under18,
          ...(offer ? { gigId: offer.id } : { amount: (amountCents || 0) / 100 }),
          website: trap,
          recaptchaToken: await recaptcha("gift"),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) {
        window.location.href = d.url; // Stripe Checkout
        return;
      }
      setError(d.error || "Couldn't start checkout. Please try again.");
    } catch {
      setError("Couldn't start checkout. Please try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="card stack" style={{ gap: 18 }}>
      {offer ? (
        <div className="alert alert-blue stack-sm">
          <b>{offer.title}</b>
          <span className="small">
            {offer.hours} with <Link href={`/mentors/${offer.mentorId}`} className="link">{offer.mentorName}</Link> · {money(offer.priceCents)}
          </span>
          <span className="small">
            Tip: it&apos;s best if your student has messaged {offer.mentorName.split(" ")[0]} or had a free intro call first, so they know it&apos;s a good fit. Not sure? <Link href="/gift" className="link">Give credit instead</Link>.
          </span>
        </div>
      ) : (
        <fieldset className="stack-sm" style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="field-label">Amount of credit</legend>
          <div className="seg">
            {GIFT_PRESETS_CENTS.map((c) => (
              <button key={c} type="button" className="seg-opt" aria-pressed={preset === c} onClick={() => setPreset(c)}>{money(c).replace(".00", "")}</button>
            ))}
            <button type="button" className="seg-opt" aria-pressed={preset === "custom"} onClick={() => setPreset("custom")}>Other amount</button>
          </div>
          {preset === "custom" && (
            <label className="field" style={{ marginBottom: 0, maxWidth: 220 }}>
              <span className="field-label">Amount in dollars</span>
              <input className="input" inputMode="numeric" placeholder="e.g. 150" value={custom} onChange={(e) => setCustom(e.target.value)} />
              <span className="field-help">{money(GIFT_MIN_CENTS).replace(".00", "")} to {money(GIFT_MAX_CENTS).replace(".00", "")}, whole dollars.</span>
            </label>
          )}
        </fieldset>
      )}

      <div className="stack-sm">
        <b>You</b>
        <label className="field" style={{ marginBottom: 6 }}>
          <span className="field-label">Your full name</span>
          <input className="input" autoComplete="name" value={f.parentName} onChange={set("parentName")} required maxLength={100} />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Your email</span>
          <input className="input" type="email" autoComplete="email" value={f.parentEmail} onChange={set("parentEmail")} required maxLength={254} />
          <span className="field-help">Your receipt and your private gift page go here.</span>
        </label>
      </div>

      <div className="stack-sm">
        <b>Your student</b>
        <label className="field" style={{ marginBottom: 6 }}>
          <span className="field-label">Their full name</span>
          <input className="input" autoComplete="off" value={f.studentName} onChange={set("studentName")} required maxLength={100} />
        </label>
        <label className="field" style={{ marginBottom: 6 }}>
          <span className="field-label">Their email</span>
          <input className="input" type="email" autoComplete="off" value={f.studentEmail} onChange={set("studentEmail")} required maxLength={254} />
          <span className="field-help">The email they use (or will use) to log in to MentorsMD. If they already have an account, use that email.</span>
        </label>
        {sameEmail && <div role="alert" className="alert alert-danger">Use your student&apos;s own email address, not yours.</div>}
        <fieldset className="stack-sm" style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="field-label">Is your student under 18?</legend>
          <div className="seg">
            <button type="button" className="seg-opt" aria-pressed={under18 === false} onClick={() => setUnder18(false)}>18 or over</button>
            <button type="button" className="seg-opt" aria-pressed={under18 === true} onClick={() => setUnder18(true)}>Under 18</button>
          </div>
          {under18 && (
            <span className="text-muted small">
              Students under 18 need a parent or guardian&apos;s consent before they can use MentorsMD. Buying a gift doesn&apos;t count as consent: once your student sets up their account, we email the parent they name a short consent form to sign.
            </span>
          )}
        </fieldset>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">A note to your student (optional)</span>
          <textarea className="input" rows={3} maxLength={GIFT_NOTE_MAX} value={f.note} onChange={set("note")} placeholder="Good luck this cycle!" />
          <span className="field-help">Included in the email we send them.</span>
        </label>
      </div>

      <Honeypot value={trap} onChange={setTrap} />
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <button className="btn btn-primary btn-lg" style={{ alignSelf: "flex-start" }} disabled={busy}>
        {busy ? "Opening checkout…" : amountCents ? `Continue to payment: ${money(amountCents)}` : "Continue to payment"}
      </button>
      <span className="text-muted small">
        Paid securely by card through Stripe. MentorsMD refunds are given as MentorsMD credit to your student, as for every package (<Link href="/terms" className="link">Terms</Link>).
      </span>
    </form>
  );
}
