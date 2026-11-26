"use client";

import { useState } from "react";
import { Honeypot, useRecaptcha, RecaptchaNotice } from "@/components/FormGuards";
import { SERVICES } from "@/lib/options";
import { applyYearOptions } from "@/lib/leadOptions";
import { Alert, Field } from "@/components/ui";

// "Tell me when mentors join": an email signup for the waitlist. The
// heading, text, button and thank-you are edited in Admin -> Website
// (Mentors page). Signups land in Admin -> Leads -> Waitlist.
export function WaitlistBox({
  title,
  text,
  button,
  success,
  source = "mentors",
}: {
  title: string;
  text: string;
  button: string;
  success: string;
  source?: string;
}) {
  const recaptcha = useRecaptcha();
  const [email, setEmail] = useState("");
  const [service, setService] = useState("");
  const [applyYear, setApplyYear] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const recaptchaToken = await recaptcha("waitlist");
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), service, applyYear, source, website: honeypot, recaptchaToken }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || "Something went wrong. Please try again.");
      else setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Alert tone="success" className="waitlist-box">
        <b>Thanks!</b> {success}
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="card stack fields-tight waitlist-box" style={{ gap: 14 }} noValidate>
      <div className="stack-sm" style={{ gap: 4 }}>
        {title && <b className="card-title">{title}</b>}
        {text && <span className="text-secondary">{text}</span>}
      </div>
      <Field id={`waitlist-email-${source}`} label="Email" error={error === "Please enter a valid email address." ? error : undefined}>
        <input className="input" type="email" autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <div className="grid-2" style={{ gap: "0 16px" }}>
        <Field id={`waitlist-service-${source}`} label="What do you need help with?" optional>
          <select className="input" value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">Not sure yet</option>
            {SERVICES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
        <Field id={`waitlist-year-${source}`} label="Year you plan to apply" optional>
          <select className="input" value={applyYear} onChange={(e) => setApplyYear(e.target.value)}>
            <option value="">Not sure yet</option>
            {applyYearOptions().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Field>
      </div>
      <Honeypot value={honeypot} onChange={setHoneypot} />
      {error && error !== "Please enter a valid email address." && <Alert tone="danger">{error}</Alert>}
      <button className="btn btn-primary" disabled={busy} style={{ alignSelf: "flex-start" }}>
        {busy ? "Adding you…" : button}
      </button>
      <RecaptchaNotice />
    </form>
  );
}
