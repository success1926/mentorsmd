"use client";

import { useCallback, useEffect, useState } from "react";
import { SettingsSection } from "@/components/SettingsSection";
import { Alert } from "@/components/ui";
import { fmtDay } from "@/lib/format";

type Phone = { id: string; platform: string; deviceName: string | null; createdAt: string; lastUsedAt: string };

// "Phones signed in to the app" in Settings (students: /account, mentors:
// /dashboard/settings, admins: Admin -> Account & Security). API:
// /api/app/sessions. Shows nothing until the account has signed in to
// the MentorsMD app on a phone.
export function AppDevices({ admin = false }: { admin?: boolean }) {
  const [phones, setPhones] = useState<Phone[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch("/api/app/sessions").then((r) => r.json()).then((d) => setPhones(Array.isArray(d.sessions) ? d.sessions : [])).catch(() => setPhones([]));
  }, []);
  useEffect(load, [load]);

  async function signOut(id: string) {
    setBusy(id);
    setError("");
    const res = await fetch("/api/app/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sign-out", id }) });
    setBusy(null);
    if (!res.ok && res.status !== 404) setError("That didn't work. Try again.");
    load();
  }

  if (!phones || phones.length === 0) return null;
  const list = (
    <div className="stack-sm">
      {phones.map((p) => (
        <div key={p.id} className="between" style={{ gap: 12, flexWrap: "wrap" }}>
          <span>
            <strong>{p.deviceName || (p.platform === "IOS" ? "iPhone" : "Android phone")}</strong>
            <span className="text-muted"> · signed in {fmtDay(p.createdAt)} · last used {fmtDay(p.lastUsedAt)}</span>
          </span>
          <button type="button" className="btn btn-sm" disabled={busy === p.id} onClick={() => signOut(p.id)}>
            {busy === p.id ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ))}
      {error && <Alert tone="danger" className="small">{error}</Alert>}
    </div>
  );
  const description = "Lost a phone, or signed in on one you no longer use? Sign it out here.";
  // Admin -> Account & Security keeps the admin card style.
  if (admin) {
    return (
      <section className="card stack-sm">
        <h2 className="adm-card-title">Phones signed in to the app</h2>
        <span className="text-secondary">{description}</span>
        {list}
      </section>
    );
  }
  return (
    <SettingsSection title="Phones signed in to the app" description={description}>
      {list}
    </SettingsSection>
  );
}
