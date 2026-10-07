"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/Avatar";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { Icon, ICONS } from "@/components/ui";
import { BACKGROUNDS, SCHOOL_TYPES, STAGES } from "@/lib/options";
import { MedicalSchoolPicker } from "@/components/MedicalSchoolPicker";
import { BusyDatesCard, CallHoursCard, ExternalCalendarCard, TimeZoneCard } from "@/components/AvailabilitySettings";

const LIMITS = { name: 100, credential: 200, bio: 3000, awayNote: 300 };

// Crops the chosen image to a centered square and shrinks it to 600x600
// JPEG in the browser, so uploads are small and every photo is the same shape.
async function toSquareJpeg(file: File, size = 600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file couldn't be read as an image"));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't process this image");
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process image"))), "image/jpeg", 0.88)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return <div role="status" className={`alert ${m.ok ? "alert-success" : "alert-danger"}`}>{m.text}</div>;
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <span className="field-label">{label}</span>
      <div className="row">
        <input className="input grow" style={{ marginBottom: 0, fontFamily: "ui-monospace, monospace", fontSize: 13 }} readOnly value={value} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { status } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);

  // profile details
  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // search answers
  const [stage, setStage] = useState("");
  const [school, setSchool] = useState("");
  const [bgs, setBgs] = useState<string[]>([]);
  const [medSchool, setMedSchool] = useState("");
  const [searchMsg, setSearchMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // calendar
  const [feedUrl, setFeedUrl] = useState<string | null>(null);

  // availability
  const [returnDate, setReturnDate] = useState("");
  const [awayNote, setAwayNote] = useState("");
  const [availMsg, setAvailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const [activeOrders, setActiveOrders] = useState<number | null>(null);

  // password (pop-up)
  const [pwOpen, setPwOpen] = useState(false);

  function loadProfile() {
    return fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile }) => {
        if (!profile) return setLoadError(true);
        setProfile(profile);
        setName(profile.name || "");
        setCredential(profile.credential || "");
        setBio(profile.bio || "");
        setPhotoUrl(profile.photoUrl);
        setStage(profile.mentorStage || "");
        setSchool(profile.schoolType || "");
        setBgs(profile.backgrounds || []);
        setMedSchool(profile.medicalSchool || "");
        setAwayNote(profile.awayNote || "");
        setReturnDate(profile.pausedUntil ? String(profile.pausedUntil).slice(0, 10) : "");
        if (profile.role === "SELLER") {
          fetch("/api/orders").then((r) => r.json()).then((d) => setActiveOrders((d.orders || []).filter((o: any) => ["IN_ESCROW", "COMPLETED"].includes(o.status)).length)).catch(() => {});
        }
      })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    loadProfile();
    fetch("/api/profile/calendar").then((r) => r.json()).then((d) => setFeedUrl(d.feedUrl)).catch(() => {});
  }, [status]);

  // Jump to #calendar / #availability once the page has content.
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
  if (loadError) return <div className="page-narrow"><div className="alert alert-danger">Your session has ended. <Link href="/login" className="link">Log in again</Link>.</div></div>;
  if (!profile) return <div className="page-narrow text-muted">Loading…</div>;

  const isSeller = profile.role === "SELLER";
  const status_ = profile.profileStatus as string;
  const pausedNow = status_ === "PAUSED" && !(profile.pausedUntil && new Date(profile.pausedUntil) <= new Date());

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setPhotoMsg("");
    if (!file.type.startsWith("image/")) return setPhotoMsg("Please choose an image file (JPG, PNG or WebP).");
    setPhotoBusy(true);
    try {
      const square = await toSquareJpeg(file);
      const form = new FormData();
      form.append("file", new File([square], "photo.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/profile/photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPhotoUrl(data.photoUrl);
      setPhotoMsg("Photo updated.");
    } catch (err: any) {
      setPhotoMsg(err.message || "Upload failed");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    const res = await fetch("/api/profile/photo", { method: "DELETE" });
    setPhotoBusy(false);
    if (!res.ok) return setPhotoMsg("Couldn't remove the photo. Try again.");
    setPhotoUrl(null);
    setPhotoMsg("Photo removed.");
  }

  async function patchProfile(body: any, setMsg: (m: any) => void, okText: string) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: data.error || "Couldn't save" });
    if (res.ok) loadProfile();
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await patchProfile(isSeller ? { name, credential, bio } : { name }, setSaveMsg, "Saved.");
    setSaving(false);
  }

  async function calendarFeed(method: "POST" | "DELETE") {
    if (method === "POST" && feedUrl && !confirm("Reset your calendar link? The old link stops working and you'll need to add the new one to your calendar.")) return;
    const res = await fetch("/api/profile/calendar", { method });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setFeedUrl(d.feedUrl);
  }

  async function availability(body: any, okText: string) {
    setAvailMsg(null);
    const res = await fetch("/api/profile/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setAvailMsg({ ok: false, text: d.error || "Couldn't update" });
    setAvailMsg({ ok: true, text: okText });
    setConfirmRemove(false);
    loadProfile();
  }

  const webcal = feedUrl ? feedUrl.replace(/^https?:/, "webcal:") : "";

  return (
    <div className="page-mid stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">{isSeller ? "Your mentor profile" : "Your account"}</h1>
        <p className="lede">{isSeller ? "This is what students see on your profile and mentor cards." : "Update your name, calendar and password."}</p>
      </div>

      {/* ---------- Profile ---------- */}
      {isSeller && (
        <section className="card row" style={{ gap: 20, flexWrap: "wrap" }}>
          <Avatar name={name || "?"} photoUrl={photoUrl} style={{ width: 96, height: 96, fontSize: 34 }} />
          <div className="stack-sm grow" style={{ minWidth: 220 }}>
            <b>Profile photo</b>
            <span className="text-secondary">A clear, friendly headshot works best. We crop it to a square automatically.</span>
            <div className="row-wrap">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => handlePhoto(e.target.files?.[0])} />
              <button type="button" className="btn btn-primary btn-sm" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
                {photoBusy ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
              </button>
              {photoUrl && <button type="button" className="btn btn-sm" disabled={photoBusy} onClick={removePhoto}>Remove</button>}
            </div>
            {photoMsg && <span role="status" className="text-secondary">{photoMsg}</span>}
          </div>
        </section>
      )}

      <form onSubmit={saveProfile} className="card stack" style={{ gap: 4 }}>
        <h2 style={{ fontSize: 26, marginBottom: 12 }}>{isSeller ? "Profile details" : "Your name"}</h2>
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={name} maxLength={LIMITS.name} onChange={(e) => setName(e.target.value)} />
        </label>
        {isSeller && (
          <>
            <label className="field">
              <span className="field-label">Credential</span>
              <input className="input" placeholder="e.g. MS3 at [school] · Admissions interviewer" value={credential} maxLength={LIMITS.credential} onChange={(e) => setCredential(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label between">Bio <span className="text-muted">{bio.length} / {LIMITS.bio}</span></span>
              <textarea className="input" style={{ minHeight: 160 }} placeholder="Your path to med school, what you're best at helping with, and who you love working with." value={bio} maxLength={LIMITS.bio} onChange={(e) => setBio(e.target.value)} />
            </label>
          </>
        )}
        <div className="row-wrap">
          <button className="btn btn-primary" disabled={saving || !name.trim() || (isSeller && !credential.trim())}>{saving ? "Saving…" : "Save changes"}</button>
          {isSeller && <Link href={`/mentors/${profile.id}`} className="btn">View my profile</Link>}
        </div>
        <Msg m={saveMsg} />
      </form>

      {/* ---------- Mentor search questions ---------- */}
      {isSeller && (
        <section id="search" className="card stack" style={{ scrollMarginTop: 100 }}>
          <div className="stack-sm">
            <h2 style={{ fontSize: 26 }}>About you (for search)</h2>
            <span className="text-secondary">Asked once and used for all your packages. Stage and school type are required for your packages to show in search.</span>
          </div>
          <MedicalSchoolPicker value={medSchool} onChange={setMedSchool} required help="Shown on your profile. Start typing and pick your school; not listed? Type its full name." />
          <div className="field">
            <span className="field-label">Your stage</span>
            <div className="seg">
              {STAGES.map((o) => (
                <button type="button" key={o.value} className="seg-opt" aria-pressed={stage === o.value} onClick={() => setStage(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">School type</span>
            <div className="seg">
              {SCHOOL_TYPES.map((o) => (
                <button type="button" key={o.value} className="seg-opt" aria-pressed={school === o.value} onClick={() => setSchool(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Been where they are (optional, pick any)</span>
            <div className="seg">
              {BACKGROUNDS.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  className="seg-opt"
                  aria-pressed={bgs.includes(o.value)}
                  onClick={() => setBgs((prev) => (prev.includes(o.value) ? prev.filter((x) => x !== o.value) : [...prev, o.value]))}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
            disabled={!stage || !school || !medSchool.trim()}
            onClick={() => patchProfile({ mentorStage: stage, schoolType: school, backgrounds: bgs, medicalSchool: medSchool }, setSearchMsg, "Saved. Your packages can now show in search.")}
          >
            Save answers
          </button>
          <Msg m={searchMsg} />
        </section>
      )}

      {/* ---------- Students under 18 (mentors) ---------- */}
      {isSeller && <MinorsCard profile={profile} onSaved={loadProfile} />}

      {/* ---------- Call availability + busy dates (mentors) ---------- */}
      {isSeller && <CallHoursCard key={JSON.stringify([profile.weeklyHours, profile.timeZone, profile.daysOff])} profile={profile} onSaved={loadProfile} />}
      {isSeller && <BusyDatesCard />}

      {/* ---------- Calendar & calls ---------- */}
      <section id="calendar" className="card stack" style={{ scrollMarginTop: 100, gap: 20 }}>
        <div className="stack-sm">
          <h2 style={{ fontSize: 26 }}>Calendar &amp; calls</h2>
          <span className="text-secondary">
            {isSeller
              ? "Your time zone, blocking busy times from your own calendar, and adding MentorsMD calls to the calendar you already use."
              : "Your time zone, and adding your MentorsMD calls to the calendar you already use."}{" "}
            <Link href="/calendar" className="link">Open My calendar</Link>
          </span>
        </div>

        <TimeZoneCard key={profile.timeZone || "none"} initial={profile.timeZone || null} onSaved={loadProfile} />

        {isSeller && <ExternalCalendarCard profile={profile} onChanged={loadProfile} />}

        <div className="stack">
          <b>Sync to your calendar</b>
          <span className="text-secondary small">
            Your booked calls{isSeller ? " and order due dates" : ""} appear in your calendar and update on their own. This link is private, so don&apos;t share it.
          </span>
          {feedUrl ? (
            <>
              <div className="row-wrap">
                <a className="btn btn-sm" target="_blank" rel="noopener noreferrer" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}>Add to Google Calendar</a>
                <a className="btn btn-sm" target="_blank" rel="noopener noreferrer" href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=MentorsMD`}>Add to Outlook</a>
                <a className="btn btn-sm" href={webcal}>Add to Apple Calendar</a>
              </div>
              <CopyField label="Or copy the calendar link" value={feedUrl} />
              <div className="row-wrap">
                <button className="btn btn-ghost btn-sm" onClick={() => calendarFeed("POST")}>Reset link</button>
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => calendarFeed("DELETE")}>Disconnect</button>
              </div>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => calendarFeed("POST")}>Connect my calendar</button>
          )}
        </div>
      </section>

      {/* ---------- Availability ---------- */}
      {isSeller && (
        <section id="availability" className="stack" style={{ scrollMarginTop: 100 }}>
          <div className="card stack">
            <div className="between" style={{ alignItems: "flex-start" }}>
              <div className="stack-sm">
                <h2 style={{ fontSize: 26 }}>Availability</h2>
                <span className="text-secondary">
                  Taking a break for exams, rotations or interviews? Pause your profile. Students won&apos;t see you on Browse and can&apos;t book you. Orders you already have keep going, and you can still message students.
                </span>
              </div>
              {status_ !== "REMOVED" && (
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
                <button className="btn btn-soft btn-sm" style={{ alignSelf: "flex-start" }}
                  onClick={() => availability({ action: "pause", pausedUntil: returnDate || null, awayNote }, returnDate ? "Saved. You'll be visible again on your return date." : "Saved.")}>
                  Save
                </button>
              </div>
            )}
            {pausedNow && <span className="text-muted">Your profile comes back automatically on the date you pick, or when you switch this off.</span>}
          </div>

          <div className="card stack">
            <h2 style={{ fontSize: 26 }}>{status_ === "REMOVED" ? "Your profile is removed" : "Remove my profile"}</h2>
            {status_ === "REMOVED" ? (
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
          </div>
          <Msg m={availMsg} />
        </section>
      )}

      {/* ---------- Sign-in & security ---------- */}
      <section className="card stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 26 }}>Sign-in &amp; security</h2>
        <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="text-secondary">Login email</span>
          <b>{profile.email}</b>
        </div>
        {profile.role === "BUYER" && profile.dateOfBirth && (
          <div className="between" style={{ flexWrap: "wrap", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <span className="text-secondary">Date of birth</span>
            <span className="row" style={{ gap: 8 }}>
              <b>{new Date(profile.dateOfBirth).toLocaleDateString(undefined, { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" })}</b>
              {profile.minorStatus === "CONSENTED" && <span className="badge badge-success">Parent consent given</span>}
            </span>
          </div>
        )}
        {profile.hasPassword ? (
          <div className="between" style={{ flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <div className="stack-sm" style={{ gap: 0 }}>
              <span className="text-secondary">Password</span>
              <b aria-label="Password hidden" style={{ letterSpacing: 2 }}>••••••••</b>
            </div>
            <button className="btn" onClick={() => setPwOpen(true)}>Change password</button>
          </div>
        ) : (
          <p className="text-secondary" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            You sign in with Google, so there&apos;s no MentorsMD password to change.
          </p>
        )}
      </section>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} email={profile.email} />
    </div>
  );
}

// Mentors can choose not to work with students under 18 (#110).
function MinorsCard({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
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
      <Msg m={msg} />
    </section>
  );
}
