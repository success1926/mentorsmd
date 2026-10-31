"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { notifyProfileChanged } from "@/components/MentorShell";
import { TwoStepSettings } from "@/components/TwoStepSettings";
import { AppDevices } from "@/components/AppDevices";
import { DeleteAccount } from "@/components/DeleteAccount";

// Mentor Settings (mentor area v2, Oct 2026): name and sign-in, students
// under 18, payout account status, Pause (with a return date and a note)
// and Remove. These used to be on /account. The public profile is edited
// in My profile, time zone / call hours / calendar link in Calendar &
// availability. The old dashboard's "Available for new orders" switch was
// the same action as Pause, so it now lives only here.

const LIMITS = { name: 100, awayNote: 300 };

type Msg = { ok: boolean; text: string } | null;

function Note({ m }: { m: Msg }) {
  if (!m) return null;
  return <div role="status" className={`alert ${m.ok ? "alert-success" : "alert-danger"}`}>{m.text}</div>;
}

export default function MentorSettingsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [profile, setProfile] = useState<any>(null);
  const [activeOrders, setActiveOrders] = useState<number | null>(null);
  const [stripe, setStripe] = useState<{ connected: boolean; started: boolean } | null>(null);

  function loadProfile() {
    return fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile || null))
      .catch(() => {});
  }

  useEffect(() => {
    if (role !== "SELLER") return;
    loadProfile();
    fetch("/api/orders").then((r) => r.json()).then((d) => setActiveOrders((d.orders || []).filter((o: any) => ["IN_ESCROW", "COMPLETED"].includes(o.status)).length)).catch(() => {});
    fetch("/api/stripe/status").then((r) => r.json()).then((d) => setStripe({ connected: !!d.connected, started: !!d.started })).catch(() => {});
  }, [role]);

  // Old links: /account#availability -> #pause, #minors.
  useEffect(() => {
    if (profile && window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [!!profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session && role !== "SELLER") return <div className="page-narrow"><div className="alert">This page is for mentor accounts. <Link href="/account" className="link">Your account</Link></div></div>;
  if (!profile) return <div className="page-mid text-muted">Loading…</div>;

  const reload = () => {
    loadProfile();
    notifyProfileChanged();
  };

  return (
    <div className="page-mid stack-lg" style={{ gap: 24 }}>
      <div className="stack-sm">
        <h1 className="page-title">Settings</h1>
        <p className="lede">
          Your login, who you work with, and taking a break. Your public profile is edited in <Link href="/dashboard/profile" className="link">My profile</Link>.
        </p>
      </div>

      <NameAndSignIn profile={profile} onSaved={reload} />
      <TwoStepSettings />
      <AppDevices />
      <MinorsCard profile={profile} onSaved={reload} />

      <section className="card row-wrap" style={{ justifyContent: "space-between", gap: 12 }}>
        <span className="row-wrap" style={{ gap: 8 }}>
          <b>Stripe account</b>
          {stripe === null ? (
            <span className="text-muted">Checking…</span>
          ) : stripe.connected ? (
            <span className="badge badge-success">Connected</span>
          ) : (
            <span className="badge badge-warning">{stripe.started ? "Not finished" : "Not connected"}</span>
          )}
          <span className="text-secondary small">Bank details are managed on Stripe.</span>
        </span>
        <Link href="/dashboard/payouts" className="btn btn-sm">Go to Payouts</Link>
      </section>

      <PauseAndRemove profile={profile} activeOrders={activeOrders} onSaved={reload} />
      <DeleteAccount />

      <p className="text-muted small">
        Moved out of Settings: time zone, call hours and calendar link are in <Link href="/dashboard/availability" className="link">Calendar &amp; availability</Link>; photo, bio and the rest are in{" "}
        <Link href="/dashboard/profile" className="link">My profile</Link>.
      </p>
    </div>
  );
}

function NameAndSignIn({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [name, setName] = useState(profile.name || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pwOpen, setPwOpen] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: d.error || "Couldn't save" });
    if (res.ok) onSaved();
  }

  return (
    <form onSubmit={save} className="card stack" style={{ gap: 14 }}>
      <h2 style={{ fontSize: 26 }}>Name &amp; sign-in</h2>
      <label className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">Name</span>
        <input className="input" value={name} maxLength={LIMITS.name} onChange={(e) => setName(e.target.value)} />
        <span className="field-help">Shown on your profile and to your students.</span>
      </label>
      <div className="between" style={{ flexWrap: "wrap", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <span className="text-secondary">Login email</span>
        <b>{profile.email}</b>
      </div>
      {profile.hasPassword ? (
        <div className="between" style={{ flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div className="stack-sm" style={{ gap: 0 }}>
            <span className="text-secondary">Password</span>
            <b aria-label="Password hidden" style={{ letterSpacing: 2 }}>••••••••</b>
          </div>
          <button type="button" className="btn" onClick={() => setPwOpen(true)}>Change password</button>
        </div>
      ) : (
        <p className="text-secondary" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          You sign in with Google, so there&apos;s no MentorsMD password to change.
        </p>
      )}
      <div className="row-wrap">
        <button className="btn btn-primary" disabled={saving || !name.trim() || name.trim() === profile.name}>{saving ? "Saving…" : "Save"}</button>
      </div>
      <Note m={msg} />
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} email={profile.email} />
    </form>
  );
}

// Mentors can choose not to work with students under 18 (#110).
function MinorsCard({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const on = profile.acceptsMinors !== false;
  async function toggle() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acceptsMinors: !on }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Couldn't save" });
    setMsg({ ok: true, text: on ? "Saved. Students under 18 can't message or book you." : "Saved. Students under 18 can message and book you." });
    onSaved();
  }
  return (
    <section id="minors" className="card stack" style={{ scrollMarginTop: 100 }}>
      <div className="between" style={{ gap: 16, alignItems: "flex-start" }}>
        <div className="stack-sm">
          <h2 style={{ fontSize: 26 }}>Students under 18</h2>
          <span className="text-secondary">
            Students aged 13 to 17 can use MentorsMD with a parent or guardian&apos;s consent, and show an &quot;Under 18&quot; badge. Their parent gets a receipt for every order. Turn this off if you only want to work with students 18 and over (orders you already have aren&apos;t affected).
          </span>
        </div>
        <label className="switch" title={on ? "Working with students under 18" : "18 and over only"}>
          <input type="checkbox" checked={on} disabled={busy} aria-label="Work with students under 18" onChange={toggle} />
          <span />
        </label>
      </div>
      <Note m={msg} />
    </section>
  );
}

// Pause (hidden from Browse, comes back on the return date) and Remove.
function PauseAndRemove({ profile, activeOrders, onSaved }: { profile: any; activeOrders: number | null; onSaved: () => void }) {
  const status = profile.profileStatus as string;
  const pausedNow = status === "PAUSED" && !(profile.pausedUntil && new Date(profile.pausedUntil) <= new Date());
  const [returnDate, setReturnDate] = useState(profile.pausedUntil ? String(profile.pausedUntil).slice(0, 10) : "");
  const [awayNote, setAwayNote] = useState(profile.awayNote || "");
  const [msg, setMsg] = useState<Msg>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeReason, setRemoveReason] = useState("");

  async function availability(body: any, okText: string) {
    setMsg(null);
    const res = await fetch("/api/profile/availability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Couldn't update" });
    setMsg({ ok: true, text: okText });
    setConfirmRemove(false);
    onSaved();
  }

  return (
    <>
      <section id="pause" className="card stack" style={{ scrollMarginTop: 100 }}>
        <div className="between" style={{ alignItems: "flex-start", gap: 16 }}>
          <div className="stack-sm">
            <h2 style={{ fontSize: 26 }}>Pause my profile</h2>
            <span className="text-secondary">
              Taking a break for exams, rotations or interviews? Pause your profile. Students won&apos;t see you on Browse and can&apos;t book you. Orders you already have keep going, and you can still message students.
            </span>
          </div>
          {status !== "REMOVED" && (
            <label className="switch" title={pausedNow ? "Paused" : "Available"}>
              <input
                type="checkbox"
                checked={pausedNow}
                aria-label="Pause my profile"
                onChange={() => (pausedNow ? availability({ action: "unpause" }, "You're visible again.") : availability({ action: "pause" }, "Paused. You're hidden from search."))}
              />
              <span />
            </label>
          )}
        </div>
        {pausedNow && (
          <div className="grid-2">
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Back on (optional)</span>
              <input type="date" className="input" min={new Date().toISOString().slice(0, 10)} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Note on your profile (optional)</span>
              <input className="input" maxLength={LIMITS.awayNote} placeholder="On rotations until November, back soon!" value={awayNote} onChange={(e) => setAwayNote(e.target.value)} />
            </label>
            <button
              className="btn btn-soft btn-sm"
              style={{ alignSelf: "flex-start" }}
              onClick={() => availability({ action: "pause", pausedUntil: returnDate || null, awayNote }, returnDate ? "Saved. You'll be visible again on your return date." : "Saved.")}
            >
              Save
            </button>
          </div>
        )}
        {pausedNow && <span className="text-muted">Your profile comes back automatically on the date you pick, or when you switch this off.</span>}
      </section>

      <section id="remove" className="card stack" style={{ scrollMarginTop: 100 }}>
        <h2 style={{ fontSize: 26 }}>{status === "REMOVED" ? "Your profile is removed" : "Remove my profile"}</h2>
        {status === "REMOVED" ? (
          <>
            <span className="text-secondary">Your profile and packages are off the site. You can still finish active orders and get paid for them.</span>
            <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => availability({ action: "restore" }, "Welcome back. Your profile is live again.")}>Restore my profile</button>
          </>
        ) : !confirmRemove ? (
          <>
            <span className="text-secondary">
              Leaving MentorsMD for good? Your profile and packages come off the site.
              {activeOrders ? ` You'll still finish your ${activeOrders} active order${activeOrders === 1 ? "" : "s"} and get paid for them.` : ""} Your messages and order history stay available.
            </span>
            <span className="text-muted small">If you only need a break, pausing is easier to undo.</span>
            <button className="btn btn-danger" style={{ alignSelf: "flex-start" }} onClick={() => setConfirmRemove(true)}>Remove my profile</button>
          </>
        ) : (
          <div className="alert alert-danger stack">
            <b>Are you sure? If you only need a break, pausing is easier to undo.</b>
            <textarea className="input" style={{ marginBottom: 0, background: "#fff" }} placeholder="Anything we should know? (optional)" value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} />
            <div className="row-wrap">
              <button className="btn btn-danger" onClick={() => availability({ action: "remove", reason: removeReason }, "Your profile has been removed.")}>Yes, remove my profile</button>
              <button className="btn btn-primary" onClick={() => availability({ action: "pause" }, "Paused instead. You're hidden from search.")}>Pause instead</button>
              <button className="btn btn-ghost" onClick={() => setConfirmRemove(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
      <Note m={msg} />
    </>
  );
}
