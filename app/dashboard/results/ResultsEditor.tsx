"use client";

import { useCallback, useEffect, useState } from "react";
import { celebrateBadge } from "@/components/Moments";
import { MedicalSchoolPicker } from "@/components/MedicalSchoolPicker";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState, LoadingBlock } from "@/components/ui";
import { resultBadgeClass } from "@/components/admin/resultTones";
import { fmtDay } from "@/lib/format";
import { RESULT_NOTE_MAX, RESULT_STATUSES, RESULT_STATUS_LABEL, cycleOptions } from "@/lib/cycleResults";

// The student's list of schools for each cycle, with a form to add or
// change one (/api/me/cycle-results).

type Row = {
  id: string;
  cycle: number;
  school: string;
  status: string;
  appliedOn: string | null;
  interviewOn: string | null;
  decisionOn: string | null;
  mentorIds: string[];
  note: string | null;
};
type Mentor = { id: string; name: string };

const day = (d: string | null) => (d ? d.slice(0, 10) : "");
// The dates are date-only, so they're shown in UTC.
const fmt = (d: string | null) => fmtDay(d, { timeZone: "UTC" });
const EMPTY = { id: "", cycle: cycleOptions()[2], school: "", status: "APPLIED", appliedOn: "", interviewOn: "", decisionOn: "", mentorIds: [] as string[], note: "" };

export function ResultsEditor() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Moment 3 (lib/moments.ts): the school that just became an acceptance, celebrated once the list reloads.
  const [celebrate, setCelebrate] = useState<{ school: string; cycle: number } | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(() => {
    fetch("/api/me/cycle-results")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.results || []);
        setMentors(d.mentors || []);
      })
      .catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!celebrate || !rows) return;
    const hit = rows.find((r) => r.cycle === celebrate.cycle && r.school.trim().toLowerCase() === celebrate.school.toLowerCase());
    if (hit) celebrateBadge(document.querySelector(`[data-result-badge="${CSS.escape(hit.id)}"]`) || null);
    setCelebrate(null);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  function edit(r: Row) {
    setError("");
    setForm({ id: r.id, cycle: r.cycle, school: r.school, status: r.status, appliedOn: day(r.appliedOn), interviewOn: day(r.interviewOn), decisionOn: day(r.decisionOn), mentorIds: r.mentorIds, note: r.note || "" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/cycle-results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: form.id || undefined }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || "Couldn't save");
    const good = (s: string) => s === "ACCEPTED" || s === "MATRICULATING";
    const before = form.id ? rows?.find((r) => r.id === form.id) : null;
    if (good(form.status) && !(before && good(before.status))) setCelebrate({ school: form.school.trim(), cycle: form.cycle });
    setForm(null);
    load();
  }

  async function remove(r: Row) {
    if (!(await confirm({ title: `Remove ${r.school} from your ${r.cycle} list?`, confirmLabel: "Remove", danger: true }))) return;
    await fetch(`/api/me/cycle-results?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
    load();
  }

  const mentorName = (id: string) => mentors.find((m) => m.id === id)?.name;
  const cycles = Array.from(new Set((rows || []).map((r) => r.cycle))).sort((a, b) => b - a);

  return (
    <>
      {dialog}
      {!form && (
        <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => { setError(""); setForm({ ...EMPTY }); }}>
          Add a school
        </button>
      )}

      {form && (
        <form onSubmit={save} className="card stack" style={{ gap: 12 }}>
          <h2 className="block-title">{form.id ? "Update school" : "Add a school"}</h2>
          <label className="field" style={{ marginBottom: 0, maxWidth: 260 }}>
            <span className="field-label">Cycle (the year you&apos;d start medical school)</span>
            <select className="input" value={form.cycle} onChange={(e) => setForm({ ...form, cycle: Number(e.target.value) })}>
              {cycleOptions().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <MedicalSchoolPicker value={form.school} onChange={(school) => setForm({ ...form, school })} label="School" help="Start typing and pick the school." required />
          <label className="field" style={{ marginBottom: 0, maxWidth: 260 }}>
            <span className="field-label">Where it stands</span>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {RESULT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <div className="row-wrap" style={{ gap: 12 }}>
            {([["appliedOn", "Applied on"], ["interviewOn", "Interview on"], ["decisionOn", "Decision on"]] as const).map(([k, label]) => (
              <label key={k} className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">{label} (optional)</span>
                <input className="input" type="date" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <fieldset className="stack-sm" style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="field-label">MentorsMD mentors who helped (optional)</legend>
            {mentors.length === 0 ? (
              <span className="text-muted small">Mentors you&apos;ve messaged or booked show here.</span>
            ) : (
              mentors.map((m) => (
                <label key={m.id} className="check">
                  <input
                    type="checkbox"
                    checked={form.mentorIds.includes(m.id)}
                    onChange={(e) => setForm({ ...form, mentorIds: e.target.checked ? [...form.mentorIds, m.id] : form.mentorIds.filter((x) => x !== m.id) })}
                  />
                  <span>{m.name}</span>
                </label>
              ))
            )}
          </fieldset>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Note (optional)</span>
            <input className="input" maxLength={RESULT_NOTE_MAX} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          {error && <div role="alert" className="alert alert-danger">{error}</div>}
          <div className="row-wrap">
            <button className="btn btn-primary" disabled={busy || !form.school.trim()}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {rows === null && <LoadingBlock lines={3} title={false} />}
      {rows && rows.length === 0 && !form && <EmptyState>No schools yet. Add the schools you applied to, and update each one as you hear back.</EmptyState>}
      {cycles.map((cycle) => (
        <section key={cycle} className="stack-sm">
          <h2 className="block-title">{cycle} cycle</h2>
          <div className="card" style={{ padding: "4px 20px" }}>
            {rows!.filter((r) => r.cycle === cycle).map((r) => (
              <div key={r.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <div className="grow stack-sm" style={{ gap: 2, minWidth: 220 }}>
                  <b>{r.school}</b>
                  <span className="text-muted small">
                    {[r.appliedOn && `Applied ${fmt(r.appliedOn)}`, r.interviewOn && `Interview ${fmt(r.interviewOn)}`, r.decisionOn && `Decision ${fmt(r.decisionOn)}`].filter(Boolean).join(" · ")}
                    {r.mentorIds.length ? `${r.appliedOn || r.interviewOn || r.decisionOn ? " · " : ""}Helped by ${r.mentorIds.map(mentorName).filter(Boolean).join(", ")}` : ""}
                  </span>
                  {r.note && <span className="text-muted small">{r.note}</span>}
                </div>
                <span data-result-badge={r.id} className={resultBadgeClass(r.status)}>{RESULT_STATUS_LABEL[r.status] || r.status}</span>
                <button type="button" className="btn btn-sm" onClick={() => edit(r)}>Update</button>
                <button type="button" className="btn btn-sm" onClick={() => remove(r)}>Remove</button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
