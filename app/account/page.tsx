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
import { DeleteAccount } from "@/components/DeleteAccount";
import { SettingsRow, SettingsSection } from "@/components/SettingsSection";
import { Alert, LoadingBlock, PageHeader, SaveStatus } from "@/components/ui";
import { fmtDay } from "@/lib/format";

const LIMITS = { name: 100 };

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
      })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    if (status !== "authenticated" || isSeller) return;
    loadProfile();
  }, [status, isSeller]);

  // Jump to #time-zone, #two-step… once the page has content.
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
  if (isSeller) return <div className="page-mid"><LoadingBlock lines={2} label="Opening your mentor settings…" /></div>;
  if (loadError) return <div className="page-mid"><Alert tone="danger">Your session has ended. <Link href="/login" className="link">Log in again</Link>.</Alert></div>;
  if (!profile) return <div className="page-mid"><LoadingBlock lines={3} cards={3} /></div>;
  return <AccountSettings profile={profile} isStudent={isStudent} onReload={loadProfile} />;
}

// Name and login (students); name (admins, who manage sign-in below).
function NameSection({ profile, onSaved, signIn, onChangePassword }: { profile: any; onSaved: () => void; signIn: boolean; onChangePassword: () => void }) {
  const [name, setName] = useState(profile.name || "");
  const [save, setSave] = useState<{ state: "idle" | "saving" | "saved" | "error"; error?: string }>({ state: "idle" });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSave({ state: "saving" });
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await res.json().catch(() => ({}));
    setSave(res.ok ? { state: "saved" } : { state: "error", error: data.error || "Couldn't save" });
    if (res.ok) onSaved();
  }
  return (
    <SettingsSection id="profile" title={signIn ? "Name & sign-in" : "Your name"}>
      <form onSubmit={submit} className="stack-sm">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Name</span>
          <input className="input" value={name} maxLength={LIMITS.name} onChange={(e) => { setName(e.target.value); setSave({ state: "idle" }); }} />
        </label>
        <div className="settings-save">
          <button className="btn btn-primary" disabled={save.state === "saving" || !name.trim() || name.trim() === profile.name}>Save changes</button>
          <SaveStatus state={save.state} error={save.error} />
        </div>
      </form>
      {signIn && (
        <>
          <SettingsRow label="Login email"><b>{profile.email}</b></SettingsRow>
          {profile.hasPassword ? (
            <SettingsRow label="Password" action={<button type="button" className="btn btn-sm" onClick={onChangePassword}>Change password</button>}>
              <b aria-label="Password hidden" style={{ letterSpacing: 2 }}>••••••••</b>
            </SettingsRow>
          ) : (
            <SettingsRow label="Password"><span>You sign in with Google, so there&apos;s no MentorsMD password to change.</span></SettingsRow>
          )}
        </>
      )}
    </SettingsSection>
  );
}

const fmtLong = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });

// Settings for students and admins, one layout. Students: name and
// sign-in, 2-step, app phones, time zone, age & parent consent (under 18
// only), payments, delete, log out. Admins: name, time zone with calendar
// sync, sign-in.
function AccountSettings({ profile, isStudent, onReload }: { profile: any; isStudent: boolean; onReload: () => void }) {
  const [pwOpen, setPwOpen] = useState(false);
  const minor = isStudent && !!profile.minorStatus;
  return (
    <div className="page-mid stack-lg" style={{ gap: 24 }}>
      <PageHeader title="Settings" lede={isStudent ? "Your login, time zone and payments." : "Your name, time zone, calendar and sign-in."} />

      <NameSection profile={profile} onSaved={onReload} signIn={isStudent} onChangePassword={() => setPwOpen(true)} />

      {isStudent && <TwoStepSettings />}
      {isStudent && <AppDevices />}

      <SettingsSection
        id="time-zone"
        title="Time zone"
        description={
          isStudent ? (
            <>To add your MentorsMD calls to your own calendar app, use <Link href="/calendar#calendar-sync" className="link">Calendar sync</Link> on your Calendar.</>
          ) : undefined
        }
      >
        <TimeZoneCard key={profile.timeZone || "none"} initial={profile.timeZone || null} onSaved={onReload} />
      </SettingsSection>

      {!isStudent && (
        <SettingsSection id="calendar" title="Calendar sync" description="Add your MentorsMD calls to the calendar you already use.">
          <CalendarSync showTitle={false} />
        </SettingsSection>
      )}

      {minor && (
        <SettingsSection id="age" title="Age &amp; parent consent" badge={<span className="badge badge-warning">Under 18</span>}>
          {profile.dateOfBirth && (
            <SettingsRow label="Date of birth"><b>{fmtLong(profile.dateOfBirth)}</b></SettingsRow>
          )}
          <SettingsRow
            label="Parent or guardian consent"
            action={
              profile.minorStatus === "CONSENTED" ? (
                <span className="badge badge-success">Given{profile.parentConsentAt ? ` ${fmtDay(profile.parentConsentAt)}` : ""}</span>
              ) : profile.minorStatus === "PENDING" ? (
                <span className="badge badge-warning">Waiting for your parent</span>
              ) : (
                <span className="badge">Not given</span>
              )
            }
          />
          <span className="text-muted small">
            Your parent gets a receipt for every order and can see your orders and calls. <Link href="/parental-consent" className="link">How parent consent works</Link>
          </span>
        </SettingsSection>
      )}

      {isStudent && (
        <SettingsSection id="payments" title="Payments" className="settings-links">
          <div>
            <Link href="/receipts" className="link-row">
              <span className="stack-sm" style={{ gap: 0 }}>
                <b>Receipts</b>
                <span className="text-secondary small">Every package and added hours you&apos;ve paid for, with Stripe receipts.</span>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/credit" className="link-row">
              <span className="stack-sm" style={{ gap: 0 }}>
                <b>MentorsMD credit</b>
                <span className="text-secondary small">Your balance and history. Used automatically at checkout; it never expires.</span>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </SettingsSection>
      )}

      {!isStudent && <SignInCard profile={profile} onChangePassword={() => setPwOpen(true)} />}

      {isStudent && <DeleteAccount />}

      {isStudent && (
        <SettingsSection
          title="Log out"
          description="You'll be logged out on this device and any other open tabs."
          aside={<button type="button" className="btn btn-sm" style={{ color: "var(--danger)" }} onClick={() => logOut()}>Log out</button>}
        />
      )}
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} email={profile.email} />
    </div>
  );
}
