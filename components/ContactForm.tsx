"use client";

import { useState } from "react";
import { Honeypot, useRecaptcha, RecaptchaNotice } from "@/components/FormGuards";
import { CONTACT_LIMITS as L, CONTACT_TOPICS } from "@/lib/leadOptions";
import { Alert, Field } from "@/components/ui";

// The message form on /contact. Messages land in Admin -> Leads ->
// Contact messages and are emailed to the team inbox. The heading, text
// and thank-you are edited in Admin -> Website (Contact page).
export function ContactForm({ title, intro, success, defaultTopic = "STUDENT" }: { title: string; intro: string; success: string; defaultTopic?: string }) {
  const recaptcha = useRecaptcha();
  const [form, setForm] = useState({ name: "", email: "", topic: defaultTopic, message: "" });
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  // Which field the error is about, so it shows under that field.
  const [fieldErr, setFieldErr] = useState<"" | "name" | "email" | "message">("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErr("");
    const fail = (f: "name" | "email" | "message", msg: string) => {
      setFieldErr(f);
      setError(msg);
    };
    if (!form.name.trim()) return fail("name", "Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return fail("email", "Please enter a valid email address.");
    if (form.message.trim().length < L.messageMin) return fail("message", "Please write a little more in your message.");
    setBusy(true);
    try {
      const recaptchaToken = await recaptcha("contact");
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, website: honeypot, recaptchaToken }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || "Something went wrong. Please try again, or email us instead.");
      else setDone(true);
    } catch {
      setError("Something went wrong. Please try again, or email us instead.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Alert tone="success">
        <b>Message sent.</b> {success}
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="card stack" style={{ gap: 0 }} noValidate id="message">
      <div className="stack-sm" style={{ gap: 4, marginBottom: 16 }}>
        {title && <h2 className="block-title">{title}</h2>}
        {intro && <span className="text-secondary">{intro}</span>}
      </div>
      <div className="grid-2" style={{ gap: "0 20px" }}>
        <Field id="contact-name" label="Name" error={fieldErr === "name" ? error : undefined}>
          <input className="input" autoComplete="name" maxLength={L.name} value={form.name} onChange={set("name")} required />
        </Field>
        <Field id="contact-email" label="Email" error={fieldErr === "email" ? error : undefined}>
          <input className="input" type="email" autoComplete="email" maxLength={L.email} value={form.email} onChange={set("email")} required />
        </Field>
      </div>
      <Field id="contact-topic" label="About you">
        <select className="input" value={form.topic} onChange={set("topic")}>
          {CONTACT_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>{t.formLabel}</option>
          ))}
        </select>
      </Field>
      <Field id="contact-message" label="Message" error={fieldErr === "message" ? error : undefined}>
        <textarea className="input" rows={6} maxLength={L.message} value={form.message} onChange={set("message")} required />
      </Field>
      <Honeypot value={honeypot} onChange={setHoneypot} />
      {error && !fieldErr && <Alert tone="danger" style={{ marginBottom: 14 }}>{error}</Alert>}
      <button className="btn btn-primary btn-lg" disabled={busy} style={{ alignSelf: "flex-start" }}>
        {busy ? "Sending…" : "Send message"}
      </button>
      <RecaptchaNotice />
    </form>
  );
}
