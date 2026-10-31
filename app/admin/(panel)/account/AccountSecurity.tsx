"use client";

import { useState } from "react";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { logOut } from "@/components/TopNav";
import { useAdminDialog } from "@/components/admin/AdminDialog";
import { AppDevices } from "@/components/AppDevices";

// The Account & Security page's sections (app/admin/(panel)/account/page.tsx).
export function AccountSecurity({ name, email, roleName, hasPassword, twoStep, joined }: { name: string; email: string; roleName: string; hasPassword: boolean; twoStep: "TOTP" | "EMAIL" | null; joined: string | null }) {
  const [pwOpen, setPwOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; which: "devices" | "trust" } | null>(null);
  const { confirm, dialog } = useAdminDialog();

  async function post(action: string) {
    const res = await fetch("/api/admin/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, d };
  }

  async function signOutOthers() {
    if (!(await confirm({ title: "Sign out of all other devices?", body: "Every other browser and phone logged in to this account is logged out right away. You stay logged in here.", confirmLabel: "Sign Out Other Devices" }))) return;
    setMsg(null);
    const { ok, d } = await post("sign-out-others");
    if (!ok) return setMsg({ ok: false, text: d.error || "That didn't work. Try again.", which: "devices" });
    // This browser's login couldn't be kept (rare): log in again.
    if (d.signedOut) return logOut("/login");
    setMsg({ ok: true, text: "Done. Every other device is logged out.", which: "devices" });
  }

  async function forgetDevices() {
    if (!(await confirm({ title: "Forget every trusted device?", body: "Each one, this one included, will need a 2-step code at the next login.", confirmLabel: "Forget Devices" }))) return;
    setMsg(null);
    const { ok, d } = await post("forget-devices");
    setMsg(ok ? { ok: true, text: "Done. Every device will need a code at the next login.", which: "trust" } : { ok: false, text: d.error || "That didn't work. Try again.", which: "trust" });
  }

  const note = (which: "devices" | "trust") =>
    msg?.which === which ? <div role={msg.ok ? "status" : "alert"} className={`alert ${msg.ok ? "alert-success" : "alert-danger"} small`}>{msg.text}</div> : null;

  return (
    <div className="page stack-lg adm-account" style={{ gap: 24 }}>
      {dialog}
      <div className="stack-sm">
        <h1 className="page-title">Account &amp; Security</h1>
        <p className="text-secondary" style={{ overflowWrap: "anywhere" }}>
          {name} · {email} · <span className="badge">{roleName}</span>
          {joined ? ` · on the team since ${new Date(joined).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}
        </p>
      </div>

      <section className="card stack-sm">
        <h2 className="adm-card-title">Password</h2>
        {hasPassword ? (
          <>
            <span className="text-secondary">Choose a new password for {email}. Other devices are logged out when you change it; this browser logs straight back in (you may be asked for your 2-step code).</span>
            <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setPwOpen(true)}>Change Password</button>
          </>
        ) : (
          <span className="text-secondary">This account has no MentorsMD password. Use &ldquo;Forgot password&rdquo; on the login page to set one.</span>
        )}
      </section>

      <section className="card stack-sm">
        <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
          <h2 className="adm-card-title">2-Step Verification</h2>
          <span className={`badge ${twoStep ? "badge-success" : "badge-warning"}`}>{twoStep ? "On" : "Not set up yet"}</span>
        </div>
        <span className="text-secondary">
          {twoStep === "TOTP"
            ? "Always on for the admin team. After your password, you enter the 6-digit code from your authenticator app."
            : twoStep === "EMAIL"
            ? `Always on for the admin team. After your password, we email a 6-digit code to ${email}.`
            : "Always on for the admin team. You'll set it up at your next login."}{" "}
          If you ticked &ldquo;Trust this device for 30 days&rdquo;, you won&apos;t be asked again on that device. To switch method, ask an Owner to reset your 2-step (Team &amp; Roles); you choose again at your next login.
        </span>
        {twoStep && (
          <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={forgetDevices}>Forget Trusted Devices</button>
        )}
        {note("trust")}
      </section>

      <section className="card stack-sm">
        <h2 className="adm-card-title">Signed-In Devices</h2>
        <span className="text-secondary">Logged in somewhere you no longer use, like a shared or lost computer? Log out everywhere except here.</span>
        <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={signOutOthers}>Sign Out of All Other Devices</button>
        {note("devices")}
      </section>

      <AppDevices admin />

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} email={email} />
    </div>
  );
}
