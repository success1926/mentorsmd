"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function SitePreviewBarClient({ pageKey, pageLabel }: { pageKey: string | null; pageLabel: string | null }) {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function act(kind: "publish" | "discard") {
    if (!pageKey) return;
    if (kind === "publish" && !confirm(`Publish the changes to the ${pageLabel} page? Everyone will see them.`)) return;
    if (kind === "discard" && !confirm(`Discard the unpublished changes to the ${pageLabel} page? This can't be undone.`)) return;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/admin/website/${pageKey}/${kind}`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return setMsg("That didn't work. Try again from Admin → Website.");
    setMsg(kind === "publish" ? "Published." : "Draft discarded.");
    router.refresh();
  }

  return (
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
  );
}
