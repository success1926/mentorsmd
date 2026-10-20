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

const LIMITS = { name: 100 };

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return <div role="status" className={`alert ${m.ok ? "alert-success" : "alert-danger"}`}>{m.text}</div>;
}

// Account settings for students (and admins): name, time zone, calendar
// sync, sign-in. Mentors have their own area since Oct 2026 (mentor area
// v2): this page sends them to the page that now holds what they were
// looking for (e.g. /account#call-hours -> Calendar & availability, plain
// /account -> Settings), see mentorAccountRedirect in lib/mentorNav.ts.
export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isSeller = (session?.user as any)?.role === "SELLER";
  const [profile, setProfile] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState("");
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    if (isSeller) router.replace(mentorAccountRedirect(window.location.hash, window.location.search));
  }, [isSeller, router]);

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
          <span className="text-secondary">
            Your time zone, and adding your MentorsMD calls to the calendar you already use. <Link href="/calendar" className="link">Open My calendar</Link>
          </span>
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
