"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { EmailTabs } from "@/components/admin/AdminTabs";
import { GROUP_LABELS, type EmailGroup } from "@/lib/emailTemplates";

type Planned = { userId: string; name: string; toEmail: string; about: string; step: number; steps: number; dueAt: string };
type Reminder = {
  key: string;
  name: string;
  group: EmailGroup;
  enabled: boolean;
  timing: string;
  steps: string[];
  error: string | null;
  nextCount: number;
  next: Planned[];
  laterCount: number;
  later: Planned[];
};
type Sent = { id: string; key: string; name: string; step: number; toEmail: string; userId: string; userName: string | null; aboutName: string | null; sentAt: string };
type Data = { now: string; nextRun: string; aheadDays: number; canRun: boolean; reminders: Reminder[]; recent: Sent[] };

const fmtWhen = (d: string) => new Date(d).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const stepLabel = (p: { step: number; steps: number }) => (p.steps > 1 ? `Email ${p.step + 1} of ${p.steps}` : "");

function PlannedTable({ rows, total, showDue }: { rows: Planned[]; total: number; showDue: boolean }) {
  if (!rows.length) return <p className="text-muted">Nobody.</p>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr><th>To</th><th>About</th>{showDue && <th>Due</th>}<th>Step</th></tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={`${p.userId}-${p.about}-${p.step}`}>
              <td className="wrap-cell"><b>{p.name}</b><div className="text-muted">{p.toEmail}</div></td>
              <td className="wrap-cell">{p.about}</td>
              {showDue && <td>{fmtWhen(p.dueAt)}</td>}
              <td>{stepLabel(p) || "Only email"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > rows.length && <span className="text-muted">…and {total - rows.length} more.</span>}
    </div>
  );
}

// Admin -> Emails -> Outbox: the reminder emails the daily cron sends
// (lib/scheduledEmails.ts). For each one: who gets it on the next run,
// who's coming up in the next week, and the last reminders sent.
export default function AdminOutboxPage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    setError("");
    fetch("/api/admin/emails/outbox")
      .then((r) => r.json())
      .then((d) => (d.reminders ? setData(d) : setError(d.error || "Couldn't load the outbox.")))
      .catch(() => setError("Couldn't load the outbox."));
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function runNow() {
    if (!confirm("Send every reminder that's due right now? Only reminders that are switched on are sent, and nobody gets the same reminder twice.")) return;
    setRunning(true);
    setNotice(null);
    const res = await fetch("/api/admin/emails/outbox", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setRunning(false);
    if (!res.ok) return setNotice({ ok: false, text: d.error || "Couldn't run the reminders." });
    setNotice({ ok: true, text: `Done: ${d.total} reminder${d.total === 1 ? "" : "s"} sent.` });
    load();
  }

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;

  return (
    <div className="page stack-lg" style={{ gap: 28 }}>
      <div className="stack-sm">
        <h1 className="page-title">Emails</h1>
        <p className="lede">
          Reminder emails go out once a day{data ? `, next at ${fmtWhen(data.nextRun)}` : ""}. Here&apos;s who gets each one on the next run, who&apos;s
          coming up, and what was sent recently. Switch a reminder on or change its timing on its page in Templates.
        </p>
      </div>
      <EmailTabs />

      {notice && <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>{notice.text}</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {!data && !error && <p className="text-muted">Working out who&apos;s due…</p>}

      {data && data.canRun && (
        <div className="row-wrap">
          <button className="btn" disabled={running} onClick={runNow}>{running ? "Sending…" : "Run now"}</button>
          <span className="text-muted">Sends what&apos;s due now, the same as the daily run (Owner only).</span>
        </div>
      )}

      {data?.reminders.map((r) => (
        <section key={r.key} className="card stack" style={{ gap: 14 }}>
          <div className="row-wrap" style={{ justifyContent: "space-between" }}>
            <div className="stack-sm" style={{ gap: 2 }}>
              <Link href={`/admin/emails/${r.key}`} style={{ color: "inherit" }}><b style={{ fontSize: 17 }}>{r.name}</b></Link>
              <span className="text-secondary" style={{ fontSize: 14 }}>
                To: {GROUP_LABELS[r.group]} · {r.timing} ({r.steps.join(", ")})
              </span>
            </div>
            {r.enabled ? <span className="badge badge-success">On</span> : <span className="badge">Off</span>}
          </div>
          {r.error && <div className="alert alert-danger">Couldn&apos;t work this one out: {r.error}</div>}
          {!r.enabled && (r.nextCount > 0 || r.laterCount > 0) && (
            <div className="alert alert-blue">This reminder is off, so nobody below gets it. This is who would, if it were on.</div>
          )}
          <div className="stack-sm">
            <b>Next run{data ? ` (${fmtWhen(data.nextRun)})` : ""}: {r.nextCount}</b>
            <PlannedTable rows={r.next} total={r.nextCount} showDue={false} />
          </div>
          <div className="stack-sm">
            <b>Coming up in the next {data.aheadDays} days: {r.laterCount}</b>
            <span className="text-muted">Sent on the first daily run after the due time, unless something changes first (they buy, finish their profile...).</span>
            <PlannedTable rows={r.later} total={r.laterCount} showDue />
          </div>
        </section>
      ))}

      {data && (
        <section className="stack-sm">
          <h2 style={{ fontSize: 26 }}>Recently sent</h2>
          <span className="text-muted">The last 50 reminders. Every email, with whether it was delivered, is in the <Link href="/admin/email-log">Sent log</Link>.</span>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>When</th><th>Email</th><th>To</th><th>About</th><th>Step</th></tr>
              </thead>
              <tbody>
                {data.recent.length === 0 && (
                  <tr><td colSpan={5} className="text-muted">No reminders sent yet.</td></tr>
                )}
                {data.recent.map((s) => (
                  <tr key={s.id}>
                    <td>{fmtWhen(s.sentAt)}</td>
                    <td><Link href={`/admin/emails/${s.key}`}>{s.name}</Link></td>
                    <td className="wrap-cell">{s.userName && <b>{s.userName}</b>}<div className="text-muted">{s.toEmail}</div></td>
                    <td className="wrap-cell">{s.aboutName || <span className="text-muted">-</span>}</td>
                    <td>Email {s.step + 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
