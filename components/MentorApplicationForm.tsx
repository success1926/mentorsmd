"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import {
  APPLICATION_LIMITS as L,
  BLURB_MAX_WORDS,
  BLURB_MIN_WORDS,
  HONEYPOT_FIELD,
  RESUME_MAX_BYTES,
  RESUME_TYPES,
  countWords,
  resumeExtension,
} from "@/lib/applicationRules";
import { useRecaptcha } from "@/components/FormGuards";

// The public "Apply to mentor" form. The resume goes straight to Vercel
// Blob first (via /api/applications/resume), then the form is sent to
// /api/applications with the file's link.
export function MentorApplicationForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", medicalSchool: "", residency: "", blurb: "" });
  const [honeypot, setHoneypot] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "sending" | "done">("idle");
  const fileRef = useRef<HTMLInputElement>(null);
  const recaptcha = useRecaptcha();

  const words = countWords(form.blurb);
  const blurbOk = words >= BLURB_MIN_WORDS && words <= BLURB_MAX_WORDS;
  const ready = form.name.trim() && form.email.trim() && form.phone.trim() && form.medicalSchool.trim() && blurbOk && resume;
  const busy = status === "uploading" || status === "sending";

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value });

  function pickResume(file: File | null) {
    setError("");
    if (!file) return setResume(null);
    if (!resumeExtension(file.name)) {
      if (fileRef.current) fileRef.current.value = "";
      return setError("Your resume must be a PDF or Word file (.pdf, .doc or .docx).");
    }
    if (file.size > RESUME_MAX_BYTES) {
      if (fileRef.current) fileRef.current.value = "";
      return setError("Your resume must be 5MB or smaller.");
    }
    setResume(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy || !resume) return;
    setError("");
    setStatus("uploading");
    try {
      const ext = resumeExtension(resume.name)!;
      const safeName = resume.name.slice(0, 120).replace(/[^a-zA-Z0-9._-]+/g, "_") || `resume.${ext}`;
      const blob = await upload(`applications/${safeName}`, resume, {
        access: "public",
        handleUploadUrl: "/api/applications/resume",
        contentType: RESUME_TYPES[ext],
        clientPayload: JSON.stringify({ [HONEYPOT_FIELD]: honeypot }),
      });
      setStatus("sending");
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          resumeUrl: blob.url,
          resumeName: resume.name.slice(0, 150),
          [HONEYPOT_FIELD]: honeypot,
          recaptchaToken: await recaptcha("mentor_application"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setStatus("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setStatus("idle");
      const msg = err?.message || "";
      setError(
        /client token|upload/i.test(msg) && !/PDF|Word|5MB|today|tomorrow/i.test(msg)
          ? "We couldn't upload your resume. Check it's a PDF or Word file under 5MB and try again."
          : msg || "Something went wrong. Please try again."
      );
    }
  }

  if (status === "done") {
    return (
      <div className="card stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 30 }}>Thank you, {form.name.trim().split(" ")[0]}!</h2>
        <p className="text-secondary" style={{ lineHeight: 1.6 }}>
          Your application is in. We&apos;ve sent a confirmation to <b>{form.email.trim()}</b>. Our senior team reviews every application and usually replies within a few days. If you&apos;re a fit, you&apos;ll get a one-time invite link to set up your mentor profile.
        </p>
        <div className="row-wrap">
          <Link href="/" className="btn btn-primary">Back to MentorsMD</Link>
          <Link href="/mentors" className="btn">See our mentors</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card stack" style={{ gap: 0 }} noValidate>
      <div className="grid-2" style={{ gap: "0 20px" }}>
        <label className="field"><span className="field-label">Full name</span>
          <input className="input" autoComplete="name" maxLength={L.name} value={form.name} onChange={set("name")} required /></label>
        <label className="field"><span className="field-label">Email</span>
          <input className="input" type="email" autoComplete="email" maxLength={L.email} value={form.email} onChange={set("email")} required /></label>
        <label className="field"><span className="field-label">Phone</span>
          <input className="input" type="tel" autoComplete="tel" maxLength={L.phone} value={form.phone} onChange={set("phone")} required /></label>
        <label className="field"><span className="field-label">Medical school</span>
          <input className="input" maxLength={L.medicalSchool} placeholder="e.g. Johns Hopkins, MS3" value={form.medicalSchool} onChange={set("medicalSchool")} required /></label>
      </div>
      <label className="field"><span className="field-label">Residency (optional)</span>
        <input className="input" maxLength={L.residency} placeholder="e.g. Internal Medicine, PGY-2" value={form.residency} onChange={set("residency")} /></label>

      <label className="field">
        <span className="field-label">About you</span>
        <textarea className="input" rows={5} maxLength={L.blurbChars} value={form.blurb} onChange={set("blurb")}
          placeholder="Your path into medicine, what you'd like to help students with, and any admissions experience (interviewing, essay review, tutoring…)."
          aria-invalid={words > BLURB_MAX_WORDS} aria-describedby="blurb-count" required />
        <span id="blurb-count" className="field-help" aria-live="polite" style={words > BLURB_MAX_WORDS ? { color: "var(--danger)" } : undefined}>
          {words} / {BLURB_MAX_WORDS} words{words < BLURB_MIN_WORDS ? ` (at least ${BLURB_MIN_WORDS})` : ""}
        </span>
      </label>

      <div className="field">
        <span className="field-label">Resume</span>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: "none" }} onChange={(e) => pickResume(e.target.files?.[0] || null)} />
        {resume ? (
          <div className="between small" style={{ gap: 8 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {resume.name}</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setResume(null); if (fileRef.current) fileRef.current.value = ""; }}>Remove</button>
          </div>
        ) : (
          <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => fileRef.current?.click()}>Choose file</button>
        )}
        <span className="field-help">PDF or Word, up to 5MB.</span>
      </div>

      {/* Hidden from people; only bots fill this in. */}
      <div aria-hidden="true" style={{ position: "absolute", left: -10000, top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label>Website<input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
      </div>

      {error && <div role="alert" className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={!ready || busy}>
        {status === "uploading" ? "Uploading resume…" : status === "sending" ? "Sending…" : "Submit application"}
      </button>
    </form>
  );
}
