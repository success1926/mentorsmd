"use client";

import { useState } from "react";
import { Honeypot, useRecaptcha } from "@/components/FormGuards";
import { CONTACT_LIMITS as L, CONTACT_TOPICS } from "@/lib/leadOptions";

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
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Please enter a valid email address.");
    if (form.message.trim().length < L.messageMin) return setError("Please write a little more in your message.");
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
      <div className="card card-tint stack-sm" role="status">
        <b>Message sent</b>
        <span className="text-secondary">{success}</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card stack" style={{ gap: 0 }} noValidate id="message">
      <div className="stack-sm" style={{ gap: 4, marginBottom: 16 }}>
        {title && <h2 style={{ fontSize: 24 }}>{title}</h2>}
        {intro && <span className="text-secondary">{intro}</span>}
      </div>
      <div className="grid-2" style={{ gap: "0 20px" }}>
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" autoComplete="name" maxLength={L.name} value={form.name} onChange={set("name")} required />
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" autoComplete="email" maxLength={L.email} value={form.email} onChange={set("email")} required />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Topic</span>
        <select className="input" value={form.topic} onChange={set("topic")}>
          {CONTACT_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Message</span>
        <textarea className="input" rows={6} maxLength={L.message} value={form.message} onChange={set("message")} required />
      </label>
      <Honeypot value={honeypot} onChange={setHoneypot} />
      {error && <div role="alert" className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}
      <button className="btn btn-primary" disabled={busy} style={{ alignSelf: "flex-start" }}>
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
