"use client";

import { useEffect, useState } from "react";
import { RESULT_STATUSES, RESULT_STATUS_LABEL } from "@/lib/cycleResults";
import { csvBody } from "@/lib/csv";

// Admin -> Cycle results (read-only, lib/cycleResults.ts): what students
// recorded, school by school, and which mentors they said helped. Not
// shown anywhere public yet.
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "");

export default function AdminCycleResultsPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    fetch("/api/admin/cycle-results").then((r) => r.json()).then((d) => setRows(d.results || [])).catch(() => setRows([]));
  }, []);

  const term = q.trim().toLowerCase();
  const list = (rows || []).filter(
    (r) => (!status || r.status === status) && (!term || [r.school, r.studentName, r.studentEmail, ...r.mentors].some((x: string) => x?.toLowerCase().includes(term)))
  );
  const counts = (rows || []).reduce((m: Record<string, number>, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {});

  function exportCsv() {
    const blob = new Blob([
      "﻿" +
        csvBody(
          ["Cycle", "Student", "Email", "School", "Status", "Applied", "Interview", "Decision", "Mentors who helped", "Note", "Updated"],
          list.map((r) => [r.cycle, r.studentName, r.studentEmail, r.school, RESULT_STATUS_LABEL[r.status] || r.status, day(r.appliedOn), day(r.interviewOn), day(r.decisionOn), r.mentors.join("; "), r.note || "", day(r.updatedAt)])
        ),
    ], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cycle-results.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="page stack-lg" style={{ gap: 24 }}>
      <div className="stack-sm">
        <h1 className="page-title">Cycle results</h1>
        <p className="lede">What students recorded about their applications, school by school. Read-only, and not shown anywhere public.</p>
      </div>
      <div className="row-wrap" style={{ gap: 10 }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search school, student or mentor" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 240 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Every status ({rows?.length ?? 0})</option>
          {RESULT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label} ({counts[s.value] || 0})</option>)}
        </select>
        {list.length > 0 && <button className="btn btn-sm" onClick={exportCsv}>Download CSV</button>}
      </div>
      <div className="card" style={{ padding: "4px 20px" }}>
        {!rows && <p className="text-muted" style={{ padding: 12 }}>Loading…</p>}
        {rows && list.length === 0 && <p className="text-muted" style={{ padding: 12 }}>Nothing here yet.</p>}
        {list.map((r) => (
          <div key={r.id} className="list-row" style={{ flexWrap: "wrap" }}>
            <div className="grow stack-sm" style={{ gap: 2, minWidth: 220 }}>
              <b style={{ fontSize: 15 }}>{r.school}</b>
              <span className="text-muted small">
                {r.studentName} ({r.studentEmail}) · {r.cycle} cycle
                {r.appliedOn ? ` · applied ${fmt(r.appliedOn)}` : ""}{r.interviewOn ? ` · interview ${fmt(r.interviewOn)}` : ""}{r.decisionOn ? ` · decision ${fmt(r.decisionOn)}` : ""}
              </span>
              {r.mentors.length > 0 && <span className="text-muted small">Helped by {r.mentors.join(", ")}</span>}
              {r.note && <span className="text-muted small">{r.note}</span>}
            </div>
            <span className={`badge ${r.status === "ACCEPTED" || r.status === "MATRICULATING" ? "badge-success" : r.status === "REJECTED" ? "badge-pink" : "badge-brand"}`}>{RESULT_STATUS_LABEL[r.status] || r.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const day = (d: string | null) => (d ? d.slice(0, 10) : "");
