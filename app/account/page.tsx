"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { TimeZoneCard } from "@/components/AvailabilitySettings";
import { CalendarSync } from "@/components/CalendarSync";
import { SignInCard } from "@/components/SignInCard";
import { mentorAccountRedirect } from "@/lib/mentorNav";
import { studentAccountRedirect } from "@/lib/studentNav";
import { logOut } from "@/components/TopNav";
import { TwoStepSettings } from "@/components/TwoStepSettings";
import { AppDevices } from "@/components/AppDevices";

const LIMITS = { name: 100 };

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return <div role="status" className={`alert ${m.ok ? "alert-success" : "alert-danger"}`}>{m.text}</div>;
}

// Settings for students (student area v2, Oct 2026): name and sign-in,
// time zone, age & parent consent (under 18 only), receipts and credit,
// log out. Calendar sync moved to Calendar (old /account#calendar links go
// there, see studentAccountRedirect in lib/studentNav.ts). Admins: name,
// time zone, calendar sync, sign-in, as before. Mentors have their own area
// since Oct 2026 (mentor area v2): this page sends them to the page that
// now holds what they were looking for (e.g. /account#call-hours ->
// Calendar & availability, plain /account -> Settings), see
// mentorAccountRedirect in lib/mentorNav.ts.
export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isSeller = (session?.user as any)?.role === "SELLER";
  const isStudent = (session?.user as any)?.role === "BUYER";
  const [profile, setProfile] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState("");
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    if (isSeller) router.replace(mentorAccountRedirect(window.location.hash, window.location.search));
    if (isStudent) {
      const to = studentAccountRedirect(window.location.hash);
      if (to) router.replace(to);
    }
  }, [isSeller, isStudent, router]);

  function loadProfile() {
    return fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile }) => {
        if (!profile) return setLoadError(true);
        setProfile(profile);
        setName(profile.name || "");
      })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    if (status !== "authenticated" || isSeller) return;
    loadProfile();
  }, [status, isSeller]);

  // Jump to #calendar once the page has content.
  useEffect(() => {
    if (profile && window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [profile]);

  if (status === "unauthenticated") {
    return (
      <div className="page-narrow">
        <div className="card-narrow stack">
          <span className="text-secondary">Log in to see your account.</span>
          <Link href="/login" className="btn btn-primary btn-block">Log in</Link>
        </div>
      </div>
    );
  }
  if (isSeller) return <div className="page-narrow text-muted">Opening your mentor settings…</div>;
  if (loadError) return <div className="page-narrow"><div className="alert alert-danger">Your session has ended. <Link href="/login" className="link">Log in again</Link>.</div></div>;
  if (!profile) return <div className="page-narrow text-muted">Loading…</div>;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setSaveMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: data.error || "Couldn't save" });
    if (res.ok) loadProfile();
  }

  if (isStudent) {
    return (
      <StudentSettings
        profile={profile}
        name={name}
        setName={setName}
        saving={saving}
        saveMsg={saveMsg}
        onSaveName={saveName}
        onReload={loadProfile}
        onChangePassword={() => setPwOpen(true)}
        passwordModal={<ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} email={profile.email} />}
      />
    );
  }

  return (
    <div className="page-mid stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Your account</h1>
        <p className="lede">Update your name, calendar and password.</p>
      </div>

      <form onSubmit={saveName} className="card stack" style={{ gap: 4 }}>
        <h2 style={{ fontSize: 26, marginBottom: 12 }}>Your name</h2>
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={name} maxLength={LIMITS.name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="row-wrap">
          <button className="btn btn-primary" disabled={saving || !name.trim()}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
        <Msg m={saveMsg} />
      </form>

      {/* ---------- Calendar & calls ---------- */}
      <section id="calendar" className="card stack" style={{ scrollMarginTop: 100, gap: 20 }}>
        <div className="stack-sm">
          <h2 style={{ fontSize: 26 }}>Calendar &amp; calls</h2>
          <span className="text-secondary">Your time zone, and adding your MentorsMD calls to the calendar you already use.</span>
        </div>
        <TimeZoneCard key={profile.timeZone || "none"} initial={profile.timeZone || null} onSaved={loadProfile} />
        <CalendarSync isMentor={false} />
      </section>

      {/* ---------- Sign-in & security ---------- */}
      <SignInCard profile={profile} onChangePassword={() => setPwOpen(true)} />
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} email={profile.email} />
    </div>
  );
}

const fmtLong = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });

function StudentSettings({
  profile,
  name,
  setName,
  saving,
  saveMsg,
  onSaveName,
  onReload,
  onChangePassword,
  passwordModal,
}: {
  profile: any;
  name: string;
  setName: (v: string) => void;
  saving: boolean;
  saveMsg: { ok: boolean; text: string } | null;
  onSaveName: (e: React.FormEvent) => void;
  onReload: () => void;
  onChangePassword: () => void;
  passwordModal: React.ReactNode;
}) {
  const minor = !!profile.minorStatus;
  return (
    <div className="page-mid stack-lg" style={{ gap: 24, maxWidth: 820 }}>
      <div className="stack-sm">
        <h1 className="page-title">Settings</h1>
        <p className="lede">
          Your login, time zone and payments. Calendar sync is in <Link href="/calendar#calendar-sync" className="link">Calendar</Link>.
        </p>
      </div>

      <section id="profile" className="card stack" style={{ gap: 14, scrollMarginTop: 100 }}>
        <h2 style={{ fontSize: 24 }}>Name &amp; sign-in</h2>
        <form onSubmit={onSaveName} className="stack-sm">
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Name</span>
            <div className="row">
              <input className="input grow" style={{ marginBottom: 0 }} value={name} maxLength={LIMITS.name} onChange={(e) => setName(e.target.value)} />
              <button className="btn btn-primary" disabled={saving || !name.trim() || name === profile.name}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </label>
          <Msg m={saveMsg} />
        </form>
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
            <button type="button" className="btn btn-sm" onClick={onChangePassword}>Change password</button>
          </div>
        ) : (
          <p className="text-secondary small" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            You sign in with Google, so there&apos;s no MentorsMD password to change.
          </p>
        )}
      </section>

      <TwoStepSettings />

      <AppDevices />

      <section id="time-zone" className="card stack" style={{ gap: 14, scrollMarginTop: 100 }}>
        <h2 style={{ fontSize: 24 }}>Time zone</h2>
        <TimeZoneCard key={profile.timeZone || "none"} initial={profile.timeZone || null} onSaved={onReload} />
      </section>

      {minor && (
        <section id="age" className="card stack" style={{ gap: 14, scrollMarginTop: 100 }}>
          <div className="row" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 24 }}>Age &amp; parent consent</h2>
            <span className="badge badge-warning">Under 18</span>
          </div>
          {profile.dateOfBirth && (
            <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
              <span className="text-secondary">Date of birth</span>
              <b>{fmtLong(profile.dateOfBirth)}</b>
            </div>
          )}
          <div className="between" style={{ flexWrap: "wrap", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <span className="text-secondary">Parent or guardian consent</span>
            {profile.minorStatus === "CONSENTED" ? (
              <span className="badge badge-success">Given{profile.parentConsentAt ? ` ${new Date(profile.parentConsentAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</span>
            ) : profile.minorStatus === "PENDING" ? (
              <span className="badge badge-warning">Waiting for your parent</span>
            ) : (
              <span className="badge">Not given</span>
            )}
          </div>
          <span className="text-muted small">
            Your parent gets a receipt for every order and can see your orders and calls. <Link href="/parental-consent" className="link">How parent consent works</Link>
          </span>
        </section>
      )}

      <section id="payments" className="card stack" style={{ gap: 10, scrollMarginTop: 100 }}>
        <h2 style={{ fontSize: 24 }}>Payments</h2>
        <Link href="/receipts" className="between link-row" style={{ padding: "8px 0" }}>
          <span className="stack-sm" style={{ gap: 0 }}>
            <b>Receipts</b>
            <span className="text-secondary small">Every package and added hours you&apos;ve paid for, with Stripe receipts.</span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
        <Link href="/credit" className="between link-row" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
          <span className="stack-sm" style={{ gap: 0 }}>
            <b>MentorsMD credit</b>
            <span className="text-secondary small">Your balance and history. Used automatically at checkout; it never expires.</span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="card between" style={{ flexWrap: "wrap", gap: 12 }}>
        <span className="stack-sm" style={{ gap: 0 }}>
          <b>Log out</b>
          <span className="text-secondary small">You&apos;ll be logged out on this device and any other open tabs.</span>
        </span>
        <button type="button" className="btn btn-sm" style={{ color: "var(--danger)" }} onClick={() => logOut()}>Log out</button>
      </section>
      {passwordModal}
    </div>
  );
}
