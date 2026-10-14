"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type PageRow = { key: string; label: string; path: string; hasDraft: boolean; updatedAt: string | null; publishedAt: string | null };
const fmt = (d: string) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// Admin -> Website: pick a page to edit its text and photos.
export default function AdminWebsitePage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/website")
      .then((r) => r.json())
      .then((d) => {
        setPages(d.pages || []);
        setSetupNeeded(!!d.setupNeeded);
      })
      .catch(() => setPages([]));
  }, [isAdmin]);

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;

  return (
    <div className="page stack-lg" style={{ gap: 28 }}>
      <Link href="/admin" className="link small">← Admin</Link>
      <div className="stack-sm">
        <h1 className="page-title">Website</h1>
        <p className="lede">Change the text and photos on the public site. Save a draft, preview it on the real page, then publish.</p>
      </div>
      {setupNeeded && (
        <div className="alert alert-danger">The website editor&apos;s database table isn&apos;t set up yet (prisma/website-editor-2026-10.sql). The site is showing its built-in text.</div>
      )}
      {pages === null && <span className="text-muted">Loading…</span>}
      <div className="stack" style={{ gap: 12 }}>
        {pages?.map((p) => (
          <Link key={p.key} href={`/admin/website/${p.key}`} className="card row" style={{ gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
            <span className="stack-sm" style={{ gap: 2 }}>
              <b style={{ fontSize: 18 }}>{p.label}</b>
              <span className="text-secondary small">
                {p.key === "footer" ? "Bottom of every page" : p.path}
                {p.publishedAt ? ` · last published ${fmt(p.publishedAt)}` : " · built-in text"}
              </span>
            </span>
            <span className="row" style={{ gap: 10 }}>
              {p.hasDraft ? <span className="badge badge-pink">Unpublished changes</span> : <span className="badge">Up to date</span>}
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
