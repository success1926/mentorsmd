"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { EMAILS, EMAIL_LIST, GROUP_LABELS, GROUP_ORDER } from "@/lib/emailTemplates";

type Row = { id: string; createdAt: string; templateKey: string; toEmail: string; subject: string; status: string; providerId: string | null; error: string | null };

const fmtWhen = (d: string) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// Admin -> Email log: every email the site tried to send in the last 90
// days (who, which email, subject, sent or failed). Bodies aren't kept.
export default function AdminEmailLogPage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [key, setKey] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; rows: Row[] } | null>(null);
  const [error, setError] = useState("");

  const params = useCallback(
    (extra: Record<string, string> = {}) => {
      const sp = new URLSearchParams();
      if (query) sp.set("q", query);
      if (key) sp.set("key", key);
      if (state) sp.set("status", state);
      for (const [k, v] of Object.entries(extra)) sp.set(k, v);
      return sp.toString();
    },
    [query, key, state]
  );

  useEffect(() => {
    if (!isAdmin) return;
    setError("");
    fetch(`/api/admin/emails/log?${params({ page: String(page) })}`)
      .then((r) => r.json())
      .then((d) => (d.rows ? setData(d) : setError(d.error || "Couldn't load the log.")))
      .catch(() => setError("Couldn't load the log."));
  }, [isAdmin, params, page]);

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="page stack-lg" style={{ gap: 28 }}>
      <div className="stack-sm">
        <div className="row-wrap">
          <Link href="/admin" className="text-secondary">← Admin</Link>
          <span className="text-muted">/</span>
          <Link href="/admin/emails" className="text-secondary">Emails</Link>
        </div>
        <h1 className="page-title">Email log</h1>
        <p className="lede">Every email the site tried to send in the last 90 days, newest first. The text of each email isn&apos;t kept, only who it went to, which email and whether it was sent.</p>
      </div>

      <form
        className="ins-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q.trim());
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="log-q">Email address</label>
          <input id="log-q" className="input" type="search" placeholder="Search by email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="log-key">Email</label>
          <select id="log-key" className="input" value={key} onChange={(e) => { setKey(e.target.value); setPage(1); }}>
            <option value="">All emails</option>
            {GROUP_ORDER.map((g) => (
              <optgroup key={g} label={GROUP_LABELS[g]}>
                {EMAIL_LIST.filter((d) => d.group === g).map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="log-status">Status</label>
          <select id="log-status" className="input" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}>
            <option value="">Sent and failed</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <button className="btn" type="submit">Search</button>
        <a className="btn btn-ghost" href={`/api/admin/emails/log?${params({ format: "csv" })}`}>Download CSV</a>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}
      {!data && !error && <p className="text-muted">Loading…</p>}
      {data && (
        <div className="stack-sm">
          <span className="text-muted">{data.total.toLocaleString()} email{data.total === 1 ? "" : "s"}</span>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>When</th><th>To</th><th>Email</th><th>Subject</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr><td colSpan={5} className="text-muted">Nothing found.</td></tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtWhen(r.createdAt)}</td>
                    <td>{r.toEmail}</td>
                    <td>{EMAILS[r.templateKey] ? <Link href={`/admin/emails/${r.templateKey}`}>{EMAILS[r.templateKey].name}</Link> : r.templateKey}</td>
                    <td className="wrap-cell">{r.subject}</td>
                    <td className="wrap-cell">
                      {r.status === "SENT" ? <span className="badge badge-success">Sent</span> : <span className="badge badge-danger">Failed</span>}
                      {r.error && <div className="text-muted" style={{ marginTop: 4 }}>{r.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="row-wrap">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</button>
              <span className="text-muted">Page {page} of {pages}</span>
              <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
