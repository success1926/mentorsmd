"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { EmailTabs } from "@/components/admin/AdminTabs";
import { GROUP_LABELS, GROUP_ORDER, type EmailGroup } from "@/lib/emailTemplates";
import { LoadingBlock, PageHeader } from "@/components/ui";
import { fmtDay } from "@/lib/format";

type Row = {
  key: string;
  name: string;
  description: string;
  group: EmailGroup;
  locked: boolean;
  edited: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  reminder: { enabled: boolean; timing: string } | null; // reminder emails sent by the daily cron
};

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

  if (status === "loading") return <div className="page"><LoadingBlock lines={5} /></div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;

  const editedCount = rows?.filter((r) => r.edited).length || 0;

  return (
    <div className="page-mid stack-lg" style={{ gap: 32 }}>
      <PageHeader
        title="Emails"
        lede="The wording of every automatic email. Change a subject or text, preview it with sample data, and send yourself a test. Emails you haven't edited use the standard wording."
      />
      <div className="stack-sm">
        <EmailTabs />
        {rows && <span className="text-muted">{rows.length} emails · {editedCount} edited</span>}
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {!rows && !error && <LoadingBlock lines={3} cards={2} title={false} />}
      {rows &&
        GROUP_ORDER.map((g) => {
          const list = rows.filter((r) => r.group === g);
          if (!list.length) return null;
          return (
            <section key={g} className="stack-sm">
              <h2 className="block-title">{GROUP_LABELS[g]}</h2>
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
                    {r.reminder &&
                      (r.reminder.enabled ? (
                        <span className="badge badge-success" title={r.reminder.timing}>Reminder: on</span>
                      ) : (
                        <span className="badge" title="Switch it on from its page">Reminder: off</span>
                      ))}
                    {r.locked && !r.reminder && <span className="badge" title="Its link or code can't be removed">Security</span>}
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
