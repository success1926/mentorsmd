"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LoadingBlock, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

type PageRow = { key: string; label: string; path: string; about: string | null; hasDraft: boolean; updatedAt: string | null; publishedAt: string | null };

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

  if (status === "loading") return <div className="page"><LoadingBlock lines={5} /></div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;

  return (
    <div className="page stack-lg" style={{ gap: 28 }}>
      <PageHeader
        title="Website"
        lede="Change the text, photos and layout of the public site. Changes save as a draft automatically; check them in the preview, then publish. Tip: while logged in, hover any section of these pages on the site and click “Edit” to jump here."
      />
      {setupNeeded && (
        <div className="alert alert-danger">The website editor&apos;s database table isn&apos;t set up yet (prisma/website-editor-2026-10.sql). The site is showing its built-in text.</div>
      )}
      {pages === null && <LoadingBlock lines={0} cards={4} title={false} />}
      <div className="stack" style={{ gap: 12 }}>
        {pages?.map((p) => (
          <Link key={p.key} href={`/admin/website/${p.key}`} className="card row" style={{ gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
            <span className="stack-sm" style={{ gap: 2 }}>
              <b className="card-title">{p.label}</b>
              <span className="text-secondary small">
                {p.about || p.path}
                {p.publishedAt ? ` · last published ${fmtDateTime(p.publishedAt)}` : " · built-in text"}
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
