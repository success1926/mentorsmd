"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { EmailTabs } from "@/components/admin/AdminTabs";
import { GROUP_LABELS, GROUP_ORDER, type EmailGroup } from "@/lib/emailTemplates";

type Row = { key: string; name: string; description: string; group: EmailGroup; locked: boolean; edited: boolean; updatedAt: string | null; updatedBy: string | null };

const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Admin -> Emails: every automatic email the site sends, grouped by who
// receives it. Click one to change its wording.
export default function AdminEmailsPage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/emails")
      .then((r) => r.json())
      .then((d) => (d.emails ? setRows(d.emails) : setError(d.error || "Couldn't load the emails.")))
      .catch(() => setError("Couldn't load the emails."));
  }, [isAdmin]);

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;

  const editedCount = rows?.filter((r) => r.edited).length || 0;

  return (
    <div className="page-mid stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Emails</h1>
        <p className="lede">
          The wording of every automatic email. Change a subject or text, preview it with sample data, and send yourself a test.
          Emails you haven&apos;t edited use the standard wording.
        </p>
      </div>
      <div className="stack-sm">
        <EmailTabs />
        {rows && <span className="text-muted">{rows.length} emails · {editedCount} edited</span>}
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {!rows && !error && <p className="text-muted">Loading…</p>}
      {rows &&
        GROUP_ORDER.map((g) => {
          const list = rows.filter((r) => r.group === g);
          if (!list.length) return null;
          return (
            <section key={g} className="stack-sm">
              <h2 style={{ fontSize: 26 }}>{GROUP_LABELS[g]}</h2>
              <div className="card" style={{ padding: "4px 20px" }}>
                {list.map((r) => (
                  <Link key={r.key} href={`/admin/emails/${r.key}`} className="list-row" style={{ color: "inherit", textDecoration: "none", flexWrap: "wrap" }}>
                    <div className="grow stack-sm" style={{ gap: 2, minWidth: 220 }}>
                      <b style={{ fontSize: 15 }}>{r.name}</b>
                      <span className="text-secondary" style={{ fontSize: 14 }}>{r.description}</span>
                      {r.edited && r.updatedAt && (
                        <span className="text-muted">Edited {fmtDay(r.updatedAt)}{r.updatedBy ? ` by ${r.updatedBy}` : ""}</span>
                      )}
                    </div>
                    {r.locked && <span className="badge" title="Its link or code can't be removed">Security</span>}
                    {r.edited ? <span className="badge badge-brand">Edited</span> : <span className="badge">Standard</span>}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
