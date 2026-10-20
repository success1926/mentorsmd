"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { notifyPackagesChanged } from "@/components/NavStatus";
import { ABOUT_MAX, APPLY_YEARS, HELP_OPTIONS, SCHOOL_MAX, STUDENT_DEGREES, STUDENT_STAGES, type StudentProfile } from "@/lib/studentProfile";
import type { Option } from "@/lib/options";

// "About you" (Oct 2026): the student's optional profile for mentors
// (lib/studentProfile.ts). Everything is optional; only mentors they've
// messaged, booked or bought from can see it. With ?welcome=1 it's the
// skippable step right after signup.
export default function AboutYouPage() {
  return (
    <Suspense fallback={<div className="page-mid text-muted">Loading…</div>}>
      <AboutYou />
    </Suspense>
  );
}

const EMPTY: StudentProfile = { applyYear: null, stage: null, degree: null, school: null, helpWith: [], about: null };

function Choice({ options, value, onChange, label }: { options: Option[]; value: string | null; onChange: (v: string | null) => void; label: string }) {
  return (
    <div className="row-wrap" role="group" aria-label={label} style={{ gap: 8 }}>
      {options.map((o) => (
        <button key={o.value} type="button" className="seg-opt" aria-pressed={value === o.value} onClick={() => onChange(value === o.value ? null : o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AboutYou() {
  const router = useRouter();
  const welcome = useSearchParams()?.get("welcome") === "1";
  const { data: session, status } = useSession();
  const isStudent = (session?.user as any)?.role === "BUYER";
  const [p, setP] = useState<StudentProfile | null>(null);
  const [me, setMe] = useState<{ name: string; photoUrl: string | null; minor: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<StudentProfile>) => {
    setP((prev) => ({ ...(prev || EMPTY), ...patch }));
    setMsg(null);
  };

  useEffect(() => {
    if (!isStudent) return;
    fetch("/api/me/student-profile")
      .then((r) => r.json())
      .then((d) => {
        // Already saved or skipped once: the after-signup step isn't shown again.
        if (welcome && d.savedAt) return router.replace("/mentors");
        setP(d.profile || EMPTY);
        setMe({ name: d.name || "", photoUrl: d.photoUrl || null, minor: !!d.minor });
      })
      .catch(() => setP(EMPTY));
  }, [isStudent, welcome, router]);

  if (status === "loading") return <div className="page-mid text-muted">Loading…</div>;
  if (!isStudent) {
    return (
      <div className="page-narrow">
        <div className="alert">This page is for student accounts. <Link href="/" className="link">Go home</Link></div>
      </div>
    );
  }
  if (!p || !me) return <div className="page-mid text-muted">Loading…</div>;

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/me/student-profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Couldn't save. Please try again." });
    notifyPackagesChanged(); // the sidebar's "Add" reminder
    if (welcome) return router.push("/mentors");
    setMsg({ ok: true, text: "Saved. Your mentors see this next to your messages and before calls." });
  }

  async function skip() {
    await fetch("/api/me/student-profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skip: true }) }).catch(() => {});
    router.push("/mentors");
  }

  const aboutLeft = ABOUT_MAX - (p.about || "").length;

  return (
    <div className="page-mid stack-lg" style={{ gap: 24 }}>
      <div className="stack-sm">
        <h1 className="page-title">{welcome ? "Tell mentors a bit about you" : "About you"}</h1>
        <p className="lede">
          {welcome ? "It takes a minute, and every question is optional. " : ""}
          Mentors you message, book or buy from see this, so they know where you are before your first call. It&apos;s never shown publicly.
        </p>
      </div>

      <section className="card stack" style={{ gap: 18 }}>
        {me.minor ? (
          <span className="text-secondary small">Students under 18 don&apos;t add a profile photo. Mentors see your initials.</span>
        ) : (
          <ProfilePhoto
            name={me.name}
            photoUrl={me.photoUrl}
            onChanged={(url) => setMe({ ...me, photoUrl: url })}
            hint="Optional. Only your mentors see it. You can position and zoom it before it's saved."
          />
        )}

        <div className="stack-sm">
          <b>When are you applying?</b>
          <Choice options={APPLY_YEARS} value={p.applyYear} onChange={(v) => set({ applyYear: v })} label="When you're applying" />
        </div>

        <div className="stack-sm">
          <b>Where are you in the process?</b>
          <Choice options={STUDENT_STAGES} value={p.stage} onChange={(v) => set({ stage: v })} label="Your stage" />
        </div>

        <div className="stack-sm">
          <b>Applying to</b>
          <Choice options={STUDENT_DEGREES} value={p.degree} onChange={(v) => set({ degree: v })} label="MD, DO or both" />
        </div>

        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Undergrad school or state <span className="text-muted">(optional)</span></span>
          <input className="input" maxLength={SCHOOL_MAX} value={p.school || ""} onChange={(e) => set({ school: e.target.value })} placeholder="e.g. UCLA, or Ohio" style={{ marginBottom: 0 }} />
        </label>

        <div className="stack-sm">
          <b>What do you want help with?</b>
          <span className="text-muted small">Pick any.</span>
          <div className="row-wrap" role="group" aria-label="What you want help with" style={{ gap: 8 }}>
            {HELP_OPTIONS.map((o) => {
              const on = p.helpWith.includes(o.value);
              return (
                <button key={o.value} type="button" className="seg-opt" aria-pressed={on} onClick={() => set({ helpWith: on ? p.helpWith.filter((h) => h !== o.value) : [...p.helpWith, o.value] })}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">A few lines about you and your goals <span className="text-muted">(optional)</span></span>
          <textarea
            className="input"
            rows={3}
            maxLength={ABOUT_MAX}
            value={p.about || ""}
            onChange={(e) => set({ about: e.target.value })}
            placeholder="e.g. Biology major, first-gen, hoping for primary care. My personal statement draft needs a stronger story."
            style={{ marginBottom: 0 }}
          />
          <span className="field-help">{aboutLeft} characters left</span>
        </label>

        {msg && <div role="status" className={`alert ${msg.ok ? "alert-success" : "alert-danger"}`}>{msg.text}</div>}
        <div className="row-wrap">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : welcome ? "Save and find a mentor" : "Save"}</button>
          {welcome && <button type="button" className="btn btn-ghost" onClick={skip}>Skip for now</button>}
        </div>
      </section>
    </div>
  );
}
