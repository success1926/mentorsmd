"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminDialog } from "@/components/admin/AdminDialog";

export function SitePreviewBarClient({ pageKey, pageLabel }: { pageKey: string | null; pageLabel: string | null }) {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { confirm: confirmDialog, dialog } = useAdminDialog();
  const [msg, setMsg] = useState("");
  // Inside the editor's preview panel (Admin -> Website) the editor has its
  // own Publish/Discard buttons, so the bar is left out there.
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      setEmbedded(true);
    }
  }, []);

  async function act(kind: "publish" | "discard") {
    if (!pageKey) return;
    const ok =
      kind === "publish"
        ? await confirmDialog({ title: `Publish the ${pageLabel} page?`, body: "Everyone will see the changes.", confirmLabel: "Publish" })
        : await confirmDialog({ title: `Discard the unpublished changes to the ${pageLabel} page?`, body: "This can't be undone.", confirmLabel: "Discard", danger: true });
    if (!ok) return;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/admin/website/${pageKey}/${kind}`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return setMsg("That didn't work. Try again from Admin → Website.");
    setMsg(kind === "publish" ? "Published." : "Draft discarded.");
    router.refresh();
  }

  if (embedded) return null;
  return (
    <>
    <div
      role="status"
      style={{ position: "relative", zIndex: 60, background: "#1B1834", color: "#fff", padding: "10px 16px", fontSize: 15, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "center" }}
    >
      <span>
        <b>Previewing unpublished changes</b>
        {pageLabel ? ` (${pageLabel})` : ""}. Only admins can see this.
      </span>
      {msg && <span style={{ color: "#DDD5FF" }}>{msg}</span>}
      {pageKey && (
        <>
          <button type="button" className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 14 }} disabled={busy} onClick={() => act("publish")}>
            Publish
          </button>
          <button type="button" className="btn" style={{ padding: "6px 14px", fontSize: 14 }} disabled={busy} onClick={() => act("discard")}>
            Discard
          </button>
          <a href={`/admin/website/${pageKey}`} style={{ color: "#fff", textDecoration: "underline" }}>Back to editor</a>
        </>
      )}
      <a href={`/api/admin/website/preview/exit?to=${encodeURIComponent(path || "/")}`} style={{ color: "#fff", textDecoration: "underline" }}>
        Exit preview
      </a>
    </div>
      {dialog}
    </>
  );
}
