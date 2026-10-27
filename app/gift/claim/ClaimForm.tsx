"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { browserTimeZone } from "@/lib/tz";
import { useRecaptcha } from "@/components/FormGuards";
import { ADULT_AGE, MIN_AGE, UNDER_13_MESSAGE, ageOn, parseDob } from "@/lib/legalKinds";
import { AgreementCheckbox, ParentFields, parentComplete } from "@/components/SignupFields";

// The same questions as signup (date of birth, agreement, and for 13-17 a
// parent or guardian), plus a password. The parent who bought the gift is
// filled in as the parent or guardian; the student can change it.
export function ClaimForm({ token, email, name: startName, parentName, parentEmail }: { token: string; email: string; name: string; parentName: string; parentEmail: string }) {
  const router = useRouter();
  const recaptcha = useRecaptcha();
  const [name, setName] = useState(startName);
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [parent, setParent] = useState({ parentName, parentEmail, parentPhone: "" });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const dobDate = parseDob(dob);
  const age = dobDate ? ageOn(dobDate) : null;
  const tooYoung = age !== null && age < MIN_AGE;
  const minor = age !== null && age >= MIN_AGE && age < ADULT_AGE;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dobDate) return setError("Add your date of birth.");
    if (minor && !parentComplete(parent)) return setError("Add your parent or guardian's name, email and phone.");
    if (!agreed) return setError("Tick the box to agree to the Terms, Privacy Policy and Community Guidelines.");
    setLoading(true);
    setError("");
    const res = await fetch("/api/gift/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password, dateOfBirth: dob, agreed, timeZone: browserTimeZone(), ...(minor ? parent : {}) }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || "Something went wrong");
      setLoading(false);
      return;
    }
    const login = await signIn("credentials", { email, password, recaptchaToken: (await recaptcha("login")) || "", redirect: false });
    if (!login || login.error) {
      router.push("/login");
      return;
    }
    router.push(d.orderId ? `/orders/${d.orderId}` : "/credit");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
      <div className="stack-sm">
        <h1 className="page-title" style={{ fontSize: 36 }}>Set up your account</h1>
        <span className="text-secondary">You&apos;ll log in with <b>{email}</b>.</span>
      </div>
      <label className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">Full name</span>
        <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
      </label>
      <label className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">Choose a password</span>
        <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <span className="field-help">At least 8 characters.</span>
      </label>
      <label className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">Date of birth</span>
        <input className="input" type="date" autoComplete="bday" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} required />
        <span className="field-help">You need to be at least 13. Students under 18 need a parent or guardian&apos;s consent.</span>
      </label>
      {tooYoung && <div role="alert" className="alert alert-danger">{UNDER_13_MESSAGE}</div>}
      {minor && <ParentFields value={parent} onChange={setParent} />}
      <AgreementCheckbox checked={agreed} onChange={setAgreed} />
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={loading || !name || password.length < 8 || tooYoung}>
        {loading ? "Setting up…" : "Set up my account"}
      </button>
      {minor && <span className="text-muted small">We&apos;ll email your parent or guardian a short consent form. You can browse right away; messaging, booking and using your gift open once they consent.</span>}
      <span className="text-muted small" style={{ textAlign: "center" }}>
        Already set up? <Link href="/login" className="link">Log in</Link>
      </span>
    </form>
  );
}
