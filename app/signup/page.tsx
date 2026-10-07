"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell, GoogleButton } from "@/components/AuthShell";
import { browserTimeZone } from "@/lib/tz";
import { Honeypot, useRecaptcha } from "@/components/FormGuards";
import { ADULT_AGE, MIN_AGE, UNDER_13_MESSAGE, ageOn, parseDob } from "@/lib/legalKinds";
import { AgreementCheckbox, EMPTY_PARENT, ParentFields, parentComplete } from "@/components/SignupFields";

// Student signup. Date of birth and the agreement checkbox come first,
// because both ways to sign up (Google, or email and password) need them.
// 13-17 year olds also give a parent or guardian, who must consent before
// the account can message or book (#100, #104, #106, #107).
export default function StudentSignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [parent, setParent] = useState(EMPTY_PARENT);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [trap, setTrap] = useState("");
  const recaptcha = useRecaptcha();

  const dobDate = parseDob(dob);
  const age = dobDate ? ageOn(dobDate) : null;
  const tooYoung = age !== null && age < MIN_AGE;
  const minor = age !== null && age >= MIN_AGE && age < ADULT_AGE;
  const basicsOk = !!dobDate && !tooYoung && agreed && (!minor || parentComplete(parent));
  const parentFields = minor ? parent : {};

  function missing() {
    if (tooYoung) return UNDER_13_MESSAGE;
    if (!dobDate) return "Add your date of birth first.";
    if (minor && !parentComplete(parent)) return "Add your parent or guardian's name, email and phone first.";
    return "Tick the box to agree to the Terms, Privacy Policy and Community Guidelines first.";
  }

  async function google() {
    if (!basicsOk) return setError(missing());
    setError("");
    setLoading(true);
    const res = await fetch("/api/signup/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateOfBirth: dob, agreed, ...parentFields }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }
    signIn("google", { callbackUrl: "/mentors" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!basicsOk) return setError(missing());
    setLoading(true);
    setError("");
    const res = await fetch("/api/signup/buyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, email, password, timeZone: browserTimeZone(), website: trap, recaptchaToken: await recaptcha("signup"),
        dateOfBirth: dob, agreed, ...parentFields,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }
    await signIn("credentials", { email, password, recaptchaToken: (await recaptcha("login")) || "", redirect: false });
    router.push("/mentors");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="stack" style={{ gap: 14 }}>
        <div className="stack-sm">
          <h1 className="page-title" style={{ fontSize: 40 }}>Create your account</h1>
          <span className="text-secondary">Free for students. Message any vetted mentor before you book.</span>
        </div>

        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Date of birth</span>
          <input className="input" type="date" autoComplete="bday" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} />
          <span className="field-help">You need to be at least 13. Students under 18 need a parent or guardian&apos;s consent.</span>
        </label>
        {tooYoung && <div role="alert" className="alert alert-danger">{UNDER_13_MESSAGE}</div>}
        {minor && <ParentFields value={parent} onChange={setParent} />}
        <AgreementCheckbox checked={agreed} onChange={setAgreed} />

        <GoogleButton onClick={() => !loading && google()} label="Sign up with Google" />
        <div className="or-line">or</div>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 0 }}>
          <label className="field">
            <span className="field-label">Full name</span>
            <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="field-help">At least 8 characters.</span>
          </label>
          <Honeypot value={trap} onChange={setTrap} />
          {error && <div role="alert" className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={loading || !name || !email || password.length < 8 || tooYoung}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        {minor && (
          <span className="text-muted small">
            After you sign up we email your parent or guardian a link. You can browse mentors right away; messaging and booking open once they consent.
          </span>
        )}
        <span className="text-muted" style={{ textAlign: "center" }}>
          New here? Read our <Link href="/safety" className="link">safety tips</Link>.
        </span>
        <span className="text-secondary" style={{ textAlign: "center" }}>
          Already have an account? <Link href="/login" className="link">Log in</Link>
        </span>
        <span className="text-muted" style={{ textAlign: "center" }}>
          Want to mentor? <Link href="/become-a-mentor" className="link">Mentoring is invite-only</Link>.
        </span>
      </div>
    </AuthShell>
  );
}
