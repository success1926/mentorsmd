"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { notifyProfileChanged } from "@/components/MentorShell";
import { TwoStepSettings } from "@/components/TwoStepSettings";
import { AppDevices } from "@/components/AppDevices";
import { DeleteAccount } from "@/components/DeleteAccount";
import { SettingsRow, SettingsSection } from "@/components/SettingsSection";
import { Alert, LoadingBlock, PageHeader, SaveStatus } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";

// Mentor Settings (mentor area v2, Oct 2026): name and sign-in, students
// under 18, payout account status, Pause (with a return date and a note)
// and Remove. These used to be on /account. The public profile is edited
// in My profile, time zone / call hours / calendar link in Calendar &
// availability. The old dashboard's "Available for new orders" switch was
// the same action as Pause, so it now lives only here.
// Switches save as soon as they're flipped (with "Saving…" / "Saved" beside
// them); text fields have one "Save changes" button.

const LIMITS = { name: 100, awayNote: 300 };

type Save = { state: "idle" | "saving" | "saved" | "error"; error?: string };
const IDLE: Save = { state: "idle" };

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
    // Payouts status and the active package count, in one small request.
    fetch("/api/dashboard/summary?for=settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.payouts) setStripe({ connected: !!d.payouts.connected, started: !!d.payouts.started });
        if (typeof d.activePackages === "number") setActiveOrders(d.activePackages);
      })
      .catch(() => {});
  }, [role]);

  // Old links: /account#availability -> #pause, #minors.
  useEffect(() => {
    if (profile && window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [!!profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session && role !== "SELLER") return <div className="page-mid"><div className="alert">This page is for mentor accounts. <Link href="/account" className="link">Your account</Link></div></div>;
  if (!profile) return <div className="page-mid"><LoadingBlock lines={3} cards={3} /></div>;

  const reload = () => {
    loadProfile();
    notifyProfileChanged();
  };

  return (
    <div className="page-mid stack-lg" style={{ gap: 24 }}>
      <PageHeader
        title="Settings"
        lede={<>Your login, who you work with, and taking a break. Your public profile is edited in <Link href="/dashboard/profile" className="link">My profile</Link>.</>}
      />

      <NameAndSignIn profile={profile} onSaved={reload} />
      <TwoStepSettings />
      <AppDevices />
      <MinorsCard profile={profile} onSaved={reload} />

      <SettingsSection
        title="Stripe account"
        badge={stripe === null ? <span className="text-muted small">Checking…</span> : stripe.connected ? <span className="badge badge-success">Connected</span> : <span className="badge badge-warning">{stripe.started ? "Not finished" : "Not connected"}</span>}
        description="Bank details are managed on Stripe."
        aside={<Link href="/dashboard/payouts" className="btn btn-sm">Go to Payouts</Link>}
      />

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
  const [save, setSave] = useState<Save>(IDLE);
  const [pwOpen, setPwOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSave({ state: "saving" });
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const d = await res.json().catch(() => ({}));
    setSave(res.ok ? { state: "saved" } : { state: "error", error: d.error || "Couldn't save" });
    if (res.ok) onSaved();
  }

  return (
    <SettingsSection title="Name &amp; sign-in">
      <form onSubmit={submit} className="stack-sm">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Name</span>
          <input className="input" value={name} maxLength={LIMITS.name} onChange={(e) => { setName(e.target.value); setSave(IDLE); }} />
          <span className="field-help">Shown on your profile and to your students.</span>
        </label>
        <div className="settings-save">
          <button className="btn btn-primary" disabled={save.state === "saving" || !name.trim() || name.trim() === profile.name}>Save changes</button>
          <SaveStatus state={save.state} error={save.error} />
        </div>
      </form>
      <SettingsRow label="Login email"><b>{profile.email}</b></SettingsRow>
      {profile.hasPassword ? (
        <SettingsRow label="Password" action={<button type="button" className="btn btn-sm" onClick={() => setPwOpen(true)}>Change password</button>}>
          <b aria-label="Password hidden" style={{ letterSpacing: 2 }}>••••••••</b>
        </SettingsRow>
      ) : (
        <SettingsRow label="Password"><span>You sign in with Google, so there&apos;s no MentorsMD password to change.</span></SettingsRow>
      )}
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} email={profile.email} />
    </SettingsSection>
  );
}

// Mentors can choose not to work with students under 18 (#110).
function MinorsCard({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [save, setSave] = useState<Save>(IDLE);
  const on = profile.acceptsMinors !== false;
  async function toggle() {
    setSave({ state: "saving" });
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acceptsMinors: !on }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setSave({ state: "error", error: d.error || "Couldn't save" });
    setSave({ state: "saved" });
    onSaved();
  }
  return (
    <SettingsSection
      id="minors"
      title="Students under 18"
      description={<>Students aged 13 to 17 can use MentorsMD with a parent or guardian&apos;s consent, and show an &quot;Under 18&quot; badge. Their parent gets a receipt for every order. Turn this off if you only want to work with students 18 and over (orders you already have aren&apos;t affected).</>}
      aside={
        <>
          <SaveStatus state={save.state} error={save.error} />
          <label className="switch" title={on ? "Working with students under 18" : "18 and over only"}>
            <input type="checkbox" checked={on} disabled={save.state === "saving"} aria-label="Work with students under 18" onChange={toggle} />
            <span />
          </label>
        </>
      }
    />
  );
}

// Pause (hidden from Browse, comes back on the return date) and Remove.
function PauseAndRemove({ profile, activeOrders, onSaved }: { profile: any; activeOrders: number | null; onSaved: () => void }) {
  const status = profile.profileStatus as string;
  const pausedNow = status === "PAUSED" && !(profile.pausedUntil && new Date(profile.pausedUntil) <= new Date());
  const [returnDate, setReturnDate] = useState(profile.pausedUntil ? String(profile.pausedUntil).slice(0, 10) : "");
  const [awayNote, setAwayNote] = useState(profile.awayNote || "");
  const [pauseSave, setPauseSave] = useState<Save>(IDLE);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const { ask, dialog } = useConfirm();

  async function availability(body: any): Promise<string | undefined> {
    const res = await fetch("/api/profile/availability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return d.error || "Couldn't update";
    onSaved();
  }
  async function setPause(body: any) {
    setPauseSave({ state: "saving" });
    const err = await availability(body);
    setPauseSave(err ? { state: "error", error: err } : { state: "saved" });
  }
  async function restore() {
    setNotice(null);
    const err = await availability({ action: "restore" });
    setNotice(err ? { ok: false, text: err } : { ok: true, text: "Welcome back. Your profile is live again." });
  }
  async function remove() {
    setNotice(null);
    const reason = await ask({
      title: "Remove your profile?",
      body: "Your profile and packages come off the site. If you only need a break, pausing is easier to undo.",
      reason: { label: "Anything we should know? (optional)" },
      confirmLabel: "Yes, remove my profile",
      cancelLabel: "Keep my profile",
      danger: true,
      run: (text) => availability({ action: "remove", reason: text }),
    });
    if (reason !== null) setNotice({ ok: true, text: "Your profile has been removed." });
  }

  return (
    <>
      {dialog}
      <SettingsSection
        id="pause"
        title="Pause my profile"
        description={<>Taking a break for exams, rotations or interviews? Pause your profile. Students won&apos;t see you on Browse and can&apos;t book you. Orders you already have keep going, and you can still message students.</>}
        aside={
          status !== "REMOVED" && (
            <>
              <SaveStatus state={pauseSave.state} error={pauseSave.error} />
              <label className="switch" title={pausedNow ? "Paused" : "Available"}>
                <input type="checkbox" checked={pausedNow} disabled={pauseSave.state === "saving"} aria-label="Pause my profile" onChange={() => setPause({ action: pausedNow ? "unpause" : "pause" })} />
                <span />
              </label>
            </>
          )
        }
      >
        {pausedNow && (
          <>
            <div className="grid-2">
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Back on (optional)</span>
                <input type="date" className="input" min={new Date().toISOString().slice(0, 10)} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Note on your profile (optional)</span>
                <input className="input" maxLength={LIMITS.awayNote} placeholder="On rotations until November, back soon!" value={awayNote} onChange={(e) => setAwayNote(e.target.value)} />
              </label>
            </div>
            <div className="settings-save">
              <button className="btn btn-primary" disabled={pauseSave.state === "saving"} onClick={() => setPause({ action: "pause", pausedUntil: returnDate || null, awayNote })}>Save changes</button>
            </div>
            <span className="text-muted">Your profile comes back automatically on the date you pick, or when you switch this off.</span>
          </>
        )}
      </SettingsSection>

      <SettingsSection
        id="remove"
        title={status === "REMOVED" ? "Your profile is removed" : "Remove my profile"}
        description={
          status === "REMOVED" ? (
            "Your profile and packages are off the site. You can still finish active orders and get paid for them."
          ) : (
            <>
              Leaving MentorsMD for good? Your profile and packages come off the site.
              {activeOrders ? ` You'll still finish your ${activeOrders} active order${activeOrders === 1 ? "" : "s"} and get paid for them.` : ""} Your messages and order history stay available. If you only need a break, pausing is easier to undo.
            </>
          )
        }
      >
        {status === "REMOVED" ? (
          <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={restore}>Restore my profile</button>
        ) : (
          <button className="btn btn-danger" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove my profile</button>
        )}
        {notice && <Alert tone={notice.ok ? "success" : "danger"}>{notice.text}</Alert>}
      </SettingsSection>
    </>
  );
}
