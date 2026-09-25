"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { Avatar } from "@/components/Avatar";

const LIMITS = { name: 100, credential: 200, bio: 3000 };

// Crops the chosen image to a centered square and shrinks it to 600x600
// JPEG in the browser, so uploads are small and every photo has the same
// shape no matter what the coach picks.
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
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't process this image");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process image"))), "image/jpeg", 0.88)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function EditProfilePage() {
  const { status } = useSession();
  const [loaded, setLoaded] = useState(false);
  const [role, setRole] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile }) => {
        if (!profile) {
          setLoadError(true);
          return;
        }
        setEmail(profile.email || "");
        setRole(profile.role);
        setHasPassword(profile.hasPassword);
        setName(profile.name || "");
        setCredential(profile.credential || "");
        setBio(profile.bio || "");
        setPhotoUrl(profile.photoUrl);
        setLoaded(true);
      });
  }, [status]);

  const isSeller = role === "SELLER";

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setPhotoMsg("");
    if (!file.type.startsWith("image/")) {
      setPhotoMsg("Please choose an image file (JPG, PNG, or WebP).");
      return;
    }
    setPhotoBusy(true);
    try {
      const square = await toSquareJpeg(file);
      const form = new FormData();
      form.append("file", new File([square], "photo.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/profile/photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPhotoUrl(data.photoUrl);
      setPhotoMsg("Photo updated. It now shows on your profile and coach cards.");
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
    if (!res.ok) {
      setPhotoMsg("Couldn't remove the photo. Try again.");
      return;
    }
    setPhotoUrl(null);
    setPhotoMsg("Photo removed.");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isSeller ? { name, credential, bio } : { name }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setSaveMsg(res.ok ? { ok: true, text: "Saved. Your public profile is updated." } : { ok: false, text: data.error || "Couldn't save" });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 8) return setPwMsg({ ok: false, text: "New password must be at least 8 characters" });
    if (newPw !== confirmPw) return setPwMsg({ ok: false, text: "The two new passwords don't match" });
    setPwSaving(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json().catch(() => ({}));
    setPwSaving(false);
    if (res.ok) {
      // Changing the password signs out every other device. Sign this
      // browser back in with the new password so it stays logged in.
      await signIn("credentials", { email, password: newPw, redirect: false });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwMsg({ ok: true, text: "Password changed. Any other devices will be signed out within a few minutes." });
    } else {
      setPwMsg({ ok: false, text: data.error || "Couldn't change password" });
    }
  }

  if (status === "unauthenticated") {
    return (
      <div className="card-narrow">
        <p className="text-secondary">Log in to edit your profile.</p>
        <Link href="/login" className="btn btn-solid" style={{ width: "100%" }}>Log in</Link>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="card-narrow">
        <p className="text-secondary">Your session has ended. Please log in again.</p>
        <Link href="/login" className="btn btn-solid" style={{ width: "100%" }}>Log in</Link>
      </div>
    );
  }
  if (!loaded) return <p className="text-secondary">Loading...</p>;

  const msgStyle = (ok: boolean) => ({ fontSize: 14, marginTop: 10, color: ok ? "var(--success-fg)" : "var(--danger)" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 32, margin: "0 0 6px" }}>{isSeller ? "Edit your coach profile" : "Your account"}</h1>
        <p className="text-secondary" style={{ margin: 0, fontSize: 15 }}>
          {isSeller ? "This is what students see on your profile and coach cards." : "Update your name and password."}
        </p>
      </div>

      {isSeller && (
        <section className="card" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar name={name || "?"} photoUrl={photoUrl} style={{ width: 96, height: 96, fontSize: 32 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 600 }}>Profile photo</div>
            <div className="text-secondary">A clear, friendly headshot works best. We'll crop it to a square automatically.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => handlePhoto(e.target.files?.[0])} />
              <button type="button" className="btn btn-solid" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
                {photoBusy ? "Uploading..." : photoUrl ? "Change photo" : "Upload photo"}
              </button>
              {photoUrl && (
                <button type="button" className="btn" disabled={photoBusy} onClick={removePhoto}>Remove</button>
              )}
            </div>
            {photoMsg && <div role="status" className="text-secondary">{photoMsg}</div>}
          </div>
        </section>
      )}

      <form onSubmit={saveProfile} className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label htmlFor="name" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Name</label>
        <input id="name" className="input" value={name} maxLength={LIMITS.name} onChange={(e) => setName(e.target.value)} />

        {isSeller && (
          <>
            <label htmlFor="credential" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Credential</label>
            <input id="credential" className="input" placeholder="e.g. MS3 at [school] · Admissions interviewer" value={credential} maxLength={LIMITS.credential} onChange={(e) => setCredential(e.target.value)} />

            <label htmlFor="bio" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Bio</label>
            <textarea
              id="bio"
              className="input"
              style={{ minHeight: 160, lineHeight: 1.55 }}
              placeholder="Your path to med school, what you're best at helping with, and who you love working with."
              value={bio}
              maxLength={LIMITS.bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <div className="text-muted" style={{ textAlign: "right", marginTop: -6, marginBottom: 8 }}>{bio.length} / {LIMITS.bio}</div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-solid" disabled={saving || !name.trim() || (isSeller && !credential.trim())}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          {isSeller && <Link href="/dashboard" className="btn">Edit my packages</Link>}
        </div>
        {saveMsg && <div role="status" style={msgStyle(saveMsg.ok)}>{saveMsg.text}</div>}
      </form>

      {isSeller && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow" style={{ color: "var(--muted)" }}>Preview</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="profile-banner" style={{ height: 90 }} />
            <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
              <Avatar name={name || "?"} photoUrl={photoUrl} style={{ width: 84, height: 84, fontSize: 28, marginTop: -42, border: "4px solid #fff", position: "relative" }} />
              <div className="display" style={{ fontSize: 26 }}>{name || "Your name"}</div>
              <div style={{ fontWeight: 600 }}>{credential || "Your credential"}</div>
              <p className="text-secondary" style={{ margin: 0, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-line" }}>
                {bio || "Your bio will appear here."}
              </p>
            </div>
          </div>
        </section>
      )}

      {hasPassword ? (
        <form onSubmit={changePassword} className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={{ fontSize: 22, margin: "0 0 12px" }}>Change password</h2>
          <label htmlFor="cur" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Current password</label>
          <input id="cur" className="input" type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          <label htmlFor="new" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>New password</label>
          <input id="new" className="input" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <label htmlFor="new2" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Confirm new password</label>
          <input id="new2" className="input" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-solid" disabled={pwSaving || !currentPw || !newPw || !confirmPw}>
              {pwSaving ? "Saving..." : "Change password"}
            </button>
            <Link href="/forgot-password" className="text-secondary" style={{ textDecoration: "underline" }}>Forgot your current password?</Link>
          </div>
          {pwMsg && <div role="status" style={msgStyle(pwMsg.ok)}>{pwMsg.text}</div>}
        </form>
      ) : (
        <div className="card text-secondary" style={{ fontSize: 15 }}>
          You sign in with Google, so there's no MentorsMD password to change.
        </div>
      )}
    </div>
  );
}
