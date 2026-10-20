"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/Avatar";
import { MedicalSchoolPicker } from "@/components/MedicalSchoolPicker";
import { EDITOR_STEPS, MentorProfileEditor, ProfileStep, type EditorState } from "@/components/MentorProfileEditor";
import { PreviewProfileButton, notifyProfileChanged, useMentorStatus } from "@/components/MentorShell";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { ADMISSIONS_ROLE_TYPES, SCHOOL_TYPES, STAGES, labelFor, money } from "@/lib/options";
import { previewHref } from "@/lib/mentorNav";
import type { ProfileSection } from "@/lib/profileCompleteness";

// My profile (mentor area v2, Oct 2026): the 10 steps behind "Finish your
// profile" (lib/profileCompleteness.ts) as numbered steps that fold open
// one at a time, with a progress bar. On the right: "How students see you"
// (a preview card that updates as you type) and whether the profile is
// hidden from Browse or live. This used to be on /account (old links like
// /account#bio come here).

const LIMITS = { credential: 200 };

// Step anchors in order (step 1 basics, 2-9 the editor, 10 the rate).
const STEP_IDS = ["basics", ...EDITOR_STEPS.map(([id]) => id), "rate"];
const KEY_OF: Record<string, string> = { basics: "basics", rate: "rate", ...Object.fromEntries(EDITOR_STEPS.map(([id, key]) => [id, key])) };

type Basics = { credential: string; medicalSchool: string; mentorStage: string; schoolType: string };

export default function MyProfilePage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [profile, setProfile] = useState<any>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditorState | null>(null);
  const [basics, setBasics] = useState<Basics | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const opened = useRef(false);
  const status = useMentorStatus();

  const loadProfile = useCallback(() => {
    return fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        const p = d.profile;
        if (!p) return;
        setProfile(p);
        setPhotoUrl(p.photoUrl);
        setBasics((b) => b ?? { credential: p.credential || "", medicalSchool: p.medicalSchool || "", mentorStage: p.mentorStage || "", schoolType: p.schoolType || "" });
        // First load: open the step from the link (#bio), or the first one
        // still to do.
        if (!opened.current) {
          opened.current = true;
          const hash = window.location.hash.slice(1);
          const firstTodo = (p.progress?.sections || []).find((s: ProfileSection) => !s.done)?.key;
          setOpenId(STEP_IDS.includes(hash) ? hash : STEP_IDS.find((id) => KEY_OF[id] === firstTodo) ?? null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (role === "SELLER") loadProfile();
  }, [role, loadProfile]);

  // Scroll to the step from the link once it's on the page.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (profile && STEP_IDS.includes(hash)) document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [!!profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSaved = useCallback(() => {
    loadProfile();
    notifyProfileChanged();
  }, [loadProfile]);

  if (session && role !== "SELLER") return <div className="page-narrow"><div className="alert">This page is for mentor accounts. <Link href="/account" className="link">Your account</Link></div></div>;
  if (!profile || !basics) return <div className="page text-muted">Loading…</div>;

  const progress = profile.progress as { sections: ProfileSection[]; done: number; total: number; complete: boolean };
  const statusOf = (key: string) => progress.sections.find((s) => s.key === key);
  const pct = Math.round((progress.done / progress.total) * 100);
  const toggle = (id: string) => setOpenId(openId === id ? null : id);
  const rateCents: number | null = profile.hourlyRateCents ?? null;
  const left = progress.sections.filter((s) => !s.done);

  return (
    <div className="page stack-lg" style={{ gap: 24, maxWidth: 1180 }}>
      <div className="between" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
        <div className="stack-sm">
          <h1 className="page-title">My profile</h1>
          <p className="lede">Ten short steps. Each one saves on its own.</p>
        </div>
        <PreviewProfileButton mentorId={profile.id} />
      </div>

      <div className="stack-sm" style={{ maxWidth: 640 }}>
        <div className="between">
          <b>{progress.done} of {progress.total} steps done</b>
          <span className="text-secondary">{pct}%</span>
        </div>
        <div className="progress-track" role="progressbar" aria-label="Profile steps done" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} style={{ background: "var(--surface-2)" }}>
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="profile-steps-grid">
        <div className="stack" style={{ gap: 12, minWidth: 0 }}>
          <BasicsStep
            profile={profile}
            basics={basics}
            setBasics={setBasics}
            photoUrl={photoUrl}
            setPhotoUrl={(u) => {
              setPhotoUrl(u);
              onSaved();
            }}
            status={statusOf("basics")}
            open={openId === "basics"}
            onToggle={() => toggle("basics")}
            onDone={() => setOpenId("bio")}
            onSaved={onSaved}
          />
          <MentorProfileEditor
            key={profile.id}
            profile={profile}
            onSaved={onSaved}
            statusOf={statusOf}
            openId={openId}
            setOpenId={setOpenId}
            firstNum={2}
            nextAfterLast={{ id: "rate", label: "10 Hourly rate" }}
            onDraftChange={setDraft}
          />
          <ProfileStep
            id="rate"
            num={10}
            title="Hourly rate"
            status={statusOf("rate")}
            doneLabel={rateCents ? `${money(rateCents)}/hr` : undefined}
            open={openId === "rate"}
            onToggle={() => toggle("rate")}
          >
            <span className="text-secondary">
              {rateCents ? <>Your rate is <b>{money(rateCents)}/hr</b>. Every price on your profile is hours × rate.</> : "Set one hourly rate (at least $50). Every price on your profile is hours × rate."}
            </span>
            <Link href="/dashboard/packages#rate" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
              {rateCents ? "Edit in Rates & packages" : "Set your rate"}
            </Link>
          </ProfileStep>
        </div>

        <aside className="profile-side">
          <b style={{ fontSize: 15 }}>How students see you</b>
          <PreviewCard profile={profile} basics={basics} photoUrl={photoUrl} draft={draft} rateCents={rateCents} />
          <span className="text-muted small">Updates as you edit. The roles line only shows if you answered Yes.</span>
          <div className="card stack-sm" style={{ padding: 16 }}>
            {!progress.complete ? (
              <>
                <span className="row" style={{ gap: 8 }}><span className="mentor-status-dot warn" aria-hidden="true" /><b>Hidden until all required steps are done</b></span>
                <span className="text-secondary small">
                  {left.length} step{left.length === 1 ? "" : "s"} left: {left.map((s) => s.label).join(", ")}.
                </span>
              </>
            ) : status?.mentor && !status.mentor.listed ? (
              <>
                <span className="row" style={{ gap: 8 }}><span className="mentor-status-dot warn" aria-hidden="true" /><b>Complete, but hidden from Browse</b></span>
                <span className="text-secondary small">
                  {status.mentor.removed || status.mentor.safetyHold || status.mentor.paused ? (
                    <>
                      {status.mentor.removed ? "Your profile is removed. Restore it in " : status.mentor.safetyHold ? "Paused by MentorsMD for a safety review. Questions? See " : "Your profile is paused. Switch it back on in "}
                      <Link href="/dashboard/settings" className="link">Settings</Link>.
                    </>
                  ) : (
                    "Save any step above and you'll be listed."
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="row" style={{ gap: 8 }}><span className="mentor-status-dot" aria-hidden="true" /><b>Live on Browse</b></span>
                <span className="text-secondary small">
                  {status?.mentor && !status.mentor.payoutsStarted ? (
                    <>Students can find you. <Link href="/dashboard/payouts" className="link">Set up payouts</Link> so they can buy.</>
                  ) : (
                    "Students can find you and buy from you."
                  )}
                </span>
              </>
            )}
            <Link href={previewHref(profile.id)} className="btn btn-sm" style={{ alignSelf: "flex-start", marginTop: 4 }}>Preview my profile</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Step 1: photo, one-line credential, medical school, stage, school type.
function BasicsStep({ profile, basics, setBasics, photoUrl, setPhotoUrl, status, open, onToggle, onDone, onSaved }: {
  profile: any;
  basics: Basics;
  setBasics: (b: Basics) => void;
  photoUrl: string | null;
  setPhotoUrl: (u: string | null) => void;
  status: ProfileSection | undefined;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<Basics>) => setBasics({ ...basics, ...patch });

  async function save() {
    setSaving(true);
    setMsg(null);
    // Only what's filled in: each one is checked on its own by the server.
    const body: Record<string, string> = {};
    if (basics.credential.trim()) body.credential = basics.credential;
    if (basics.medicalSchool.trim()) body.medicalSchool = basics.medicalSchool;
    if (basics.mentorStage) body.mentorStage = basics.mentorStage;
    if (basics.schoolType) body.schoolType = basics.schoolType;
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: d.error || "Couldn't save" });
    if (!res.ok) return;
    onSaved();
    onDone();
    setTimeout(() => document.getElementById("bio")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <ProfileStep
      id="basics"
      num={1}
      title="Photo & basics"
      help="Your photo, a one-line credential, and your medical school, stage and school type. Shown on your profile and used by the Browse mentors filters."
      status={status}
      open={open}
      onToggle={onToggle}
      onSave={save}
      saving={saving}
      msg={msg}
      nextLabel="2 Bio"
    >
      <ProfilePhoto name={profile.name} photoUrl={photoUrl} onChanged={setPhotoUrl} />
      <label className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">One-line credential</span>
        <input className="input" placeholder="e.g. MS3 at [school] · Admissions interviewer" value={basics.credential} maxLength={LIMITS.credential} onChange={(e) => set({ credential: e.target.value })} />
      </label>
      <MedicalSchoolPicker value={basics.medicalSchool} onChange={(v) => set({ medicalSchool: v })} required help="Start typing and pick your school; not listed? Type its full name." />
      <div className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">Your stage</span>
        <div className="seg">
          {STAGES.map((o) => (
            <button type="button" key={o.value} className="seg-opt" aria-pressed={basics.mentorStage === o.value} onClick={() => set({ mentorStage: o.value })}>{o.label}</button>
          ))}
        </div>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">School type</span>
        <div className="seg">
          {SCHOOL_TYPES.map((o) => (
            <button type="button" key={o.value} className="seg-opt" aria-pressed={basics.schoolType === o.value} onClick={() => set({ schoolType: o.value })}>{o.label}</button>
          ))}
        </div>
      </div>
    </ProfileStep>
  );
}

// "How students see you": a small version of the Browse card, from what's
// typed (not yet saved) so it updates as the mentor edits.
function PreviewCard({ profile, basics, photoUrl, draft, rateCents }: { profile: any; basics: Basics; photoUrl: string | null; draft: EditorState | null; rateCents: number | null }) {
  const bio = (draft?.bio ?? profile.bio ?? "").trim();
  const yes = (draft ? draft.hasAdmissionsRoles : profile.hasAdmissionsRoles) === true;
  const roles: any[] = yes ? (draft?.admissionsRoles ?? profile.admissionsRoles ?? []) : [];
  const roleChips = Array.from(
    new Set<string>(roles.map((r) => (r.former ? `Former ${labelFor(ADMISSIONS_ROLE_TYPES, r.type).toLowerCase()}` : labelFor(ADMISSIONS_ROLE_TYPES, r.type))))
  );
  const line = [basics.medicalSchool, labelFor(STAGES, basics.mentorStage)].filter(Boolean).join(" · ");
  return (
    <div className="card stack-sm" style={{ padding: 16, boxShadow: "var(--shadow-sm)" }}>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <Avatar name={profile.name || "?"} photoUrl={photoUrl} style={{ width: 56, height: 56, fontSize: 20 }} />
        <div className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
          <b style={{ fontSize: 16 }}>{profile.name}</b>
          <span className="small">{basics.credential || <span className="text-muted">Your one-line credential</span>}</span>
          {line && <span className="text-muted small">{line}</span>}
        </div>
      </div>
      <p className="text-secondary small" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {bio || "The first lines of your bio show here."}
      </p>
      {(roleChips.length > 0 || basics.schoolType) && (
        <div className="row-wrap" style={{ gap: 6 }}>
          {roleChips.map((c) => <span key={c} className="badge badge-brand">{c}</span>)}
          {basics.schoolType && <span className="badge">{labelFor(SCHOOL_TYPES, basics.schoolType)}</span>}
        </div>
      )}
      <div className="between" style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 4 }}>
        <b>{rateCents ? `${money(rateCents)}/hr` : <span className="text-muted">No rate yet</span>}</b>
        <Link href={previewHref(profile.id)} className="link small">View profile</Link>
      </div>
    </div>
  );
}
