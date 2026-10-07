"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Modal } from "@/components/Modal";
import { logOut } from "@/components/TopNav";
import { ADULT_AGE, MIN_AGE, UNDER_13_MESSAGE, ageOn, parseDob } from "@/lib/legalKinds";
import { AgreementCheckbox, EMPTY_PARENT, ParentFields, parentComplete } from "@/components/SignupFields";

// The blocking screen (#101) for students and mentors:
//  - students who haven't given a date of birth yet (#104),
//  - anyone with an updated legal document to accept (#101, #103).
// Students aged 13-17 waiting for a parent's consent (#107) see a banner
// instead: they can browse, but messaging and booking stay closed until
// the parent consents (enforced on the server too, lib/gate.ts).

// Pages that stay readable without the pop-up (the documents themselves).
const OPEN_PATHS = ["/terms", "/privacy", "/community-guidelines", "/mentor-agreement", "/parental-consent", "/contact", "/safety"];
const REFRESH_MS = 60_000;

type Gate = {
  needsDob: boolean;
  legal: { kind: string; label: string; path: string; version: number; title: string; changeNote: string | null; firstTime: boolean }[];
  minor: null | { status: string; parentName: string | null; parentEmail: string | null; requestStatus: string | null; expiresAt: string | null; lastSentAt: string | null };
  blocked: boolean;
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: "long", day: "numeric" }) : "");

export function AccountGate() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  const pathname = usePathname() || "/";
  const [gate, setGate] = useState<Gate | null>(null);
  const [under13, setUnder13] = useState(false);
  const lastLoad = useRef(0);

  const applies = status === "authenticated" && (role === "BUYER" || role === "SELLER");

  const load = useCallback(() => {
    lastLoad.current = Date.now();
    fetch("/api/me/gate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (d.under13) setUnder13(true);
        else setGate(d.gate || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!applies) {
      setGate(null);
      return;
    }
    if (Date.now() - lastLoad.current > REFRESH_MS || !gate) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applies, pathname, load]);

  useEffect(() => {
    if (!applies) return;
    const onFocus = () => Date.now() - lastLoad.current > REFRESH_MS && load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [applies, load]);

  if (under13) {
    return (
      <Modal open onClose={() => {}} label="Account closed" dismissable={false}>
        <div className="stack" style={{ gap: 14 }}>
          <h2 style={{ fontSize: 26 }}>Sorry</h2>
          <p className="text-secondary">{UNDER_13_MESSAGE} Your account has been closed.</p>
          <button className="btn btn-primary" onClick={() => logOut("/")}>OK</button>
        </div>
      </Modal>
    );
  }
  if (!applies || !gate) return null;

  const openPage = OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  return (
    <>
      {gate.minor && gate.minor.status !== "CONSENTED" && !gate.needsDob && <MinorBanner gate={gate} onChange={setGate} />}
      {!openPage && gate.needsDob && <DobForm onDone={(g) => (g === "under13" ? setUnder13(true) : setGate(g))} />}
      {!openPage && !gate.needsDob && gate.legal.length > 0 && <AcceptForm gate={gate} onDone={setGate} />}
    </>
  );
}

// ---- One-time date of birth (students who signed up before it was asked, or with Google from the login page) ----
function DobForm({ onDone }: { onDone: (g: Gate | "under13") => void }) {
  const [dob, setDob] = useState("");
  const [parent, setParent] = useState(EMPTY_PARENT);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const d = parseDob(dob);
  const age = d ? ageOn(d) : null;
  const tooYoung = age !== null && age < MIN_AGE;
  const minor = age !== null && age >= MIN_AGE && age < ADULT_AGE;
  const ok = !!d && agreed && (!minor || parentComplete(parent));

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "profile", dateOfBirth: dob, agreed, ...(minor ? parent : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.under13) return onDone("under13");
    if (!res.ok) return setError(data.error || "Something went wrong");
    onDone(data.gate);
  }

  return (
    <Modal open onClose={() => {}} label="One more step" dismissable={false}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="stack-sm">
          <h2 style={{ fontSize: 28 }}>One more step</h2>
          <p className="text-secondary">We ask every student for their date of birth. Students under 18 need a parent or guardian&apos;s consent to use MentorsMD.</p>
        </div>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Date of birth</span>
          <input className="input" type="date" autoComplete="bday" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} />
        </label>
        {tooYoung && <div role="alert" className="alert alert-danger">{UNDER_13_MESSAGE} If you continue, your account will be closed.</div>}
        {minor && <ParentFields value={parent} onChange={setParent} />}
        <AgreementCheckbox checked={agreed} onChange={setAgreed} />
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <div className="row-wrap">
          <button className="btn btn-primary" disabled={busy || !ok} onClick={submit}>{busy ? "Saving…" : "Continue"}</button>
          <button className="btn btn-ghost" onClick={() => logOut("/")}>Log out</button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Updated legal documents ----
function AcceptForm({ gate, onDone }: { gate: Gate; onDone: (g: Gate) => void }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const updated = gate.legal.some((d) => !d.firstTime);

  async function accept() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/gate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept", agreed: true }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Something went wrong");
    onDone(data.gate);
  }

  return (
    <Modal open onClose={() => {}} label="Please review our updated terms" dismissable={false}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="stack-sm">
          <h2 style={{ fontSize: 28 }}>{updated ? "We've updated our terms" : "Please review our terms"}</h2>
          <p className="text-secondary">To keep using MentorsMD, please read and accept:</p>
        </div>
        <div className="stack-sm">
          {gate.legal.map((d) => (
            <div key={d.kind} className="card card-tint stack-sm" style={{ padding: 14 }}>
              <div className="between" style={{ gap: 10 }}>
                <b>{d.label}</b>
                <span className="badge">Version {d.version}</span>
              </div>
              {d.changeNote && <span className="text-secondary small" style={{ whiteSpace: "pre-wrap" }}>What changed: {d.changeNote}</span>}
              <Link href={d.path} target="_blank" className="link small">Read the {d.label} (opens in a new tab)</Link>
            </div>
          ))}
        </div>
        <label className="check" style={{ alignItems: "flex-start" }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
          <span className="small">I have read and agree to the {gate.legal.map((d) => d.label).join(", ")}.</span>
        </label>
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <div className="row-wrap">
          <button className="btn btn-primary" disabled={busy || !agreed} onClick={accept}>{busy ? "Saving…" : "Accept and continue"}</button>
          <button className="btn btn-ghost" onClick={() => logOut("/")}>Log out</button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Waiting for a parent or guardian ----
function MinorBanner({ gate, onChange }: { gate: Gate; onChange: (g: Gate) => void }) {
  const m = gate.minor!;
  const [editing, setEditing] = useState(false);
  const [parent, setParent] = useState(EMPTY_PARENT);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function post(body: any) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/me/gate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error || "Something went wrong" });
    setMsg(data.emailSent === false ? { ok: false, text: "We saved it, but the email didn't send. Please try again in a few minutes." } : { ok: true, text: "Sent. Ask them to check their inbox (and spam folder)." });
    setEditing(false);
    if (data.gate) onChange(data.gate);
  }

  const declined = m.status === "WITHDRAWN";
  const expired = m.requestStatus === "EXPIRED";
  return (
    <div className="alert alert-warning" role="status" style={{ borderRadius: 0, margin: 0 }}>
      <div className="wrap stack-sm" style={{ gap: 8 }}>
        <span>
          {declined ? (
            <><b>Your parent or guardian didn&apos;t give consent{m.requestStatus === "WITHDRAWN" ? " (or withdrew it)" : ""}.</b> You can browse mentors, but you can&apos;t message or book until a parent or guardian consents.</>
          ) : expired ? (
            <><b>The consent link we sent {m.parentEmail ? `to ${m.parentEmail} ` : ""}expired.</b> Send a new one so you can message and book mentors.</>
          ) : (
            <><b>Waiting for your parent or guardian.</b> We emailed {m.parentName || "them"}{m.parentEmail ? ` (${m.parentEmail})` : ""} a link{m.lastSentAt ? ` on ${fmt(m.lastSentAt)}` : ""}. Messaging and booking open once they consent{m.expiresAt ? ` (the link works until ${fmt(m.expiresAt)})` : ""}.</>
          )}
        </span>
        <div className="row-wrap">
          <button className="btn btn-sm" disabled={busy} onClick={() => post({ action: "resend" })}>{declined ? "Ask again" : expired ? "Send a new link" : "Send the email again"}</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setEditing((e) => !e)}>Change parent or guardian</button>
          <Link href="/parental-consent" className="link small">What they&apos;ll see</Link>
        </div>
        {editing && (
          <div className="stack-sm" style={{ maxWidth: 480 }}>
            <ParentFields value={parent} onChange={setParent} intro={false} />
            <div className="row">
              <button className="btn btn-sm btn-primary" disabled={busy || !parentComplete(parent)} onClick={() => post({ action: "parent", ...parent })}>Send to this person</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        )}
        {msg && <span className="small" style={{ fontWeight: 600 }}>{msg.text}</span>}
      </div>
    </div>
  );
}
