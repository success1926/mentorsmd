import { useState } from "react";
import { View } from "react-native";
import { LoadError, useRefresh } from "../../components/shared";
import { Btn, Card, Chip, Field, H, Hdr, Link, Loading, Note, Row, Screen, Select, Small } from "../../components/ui";
import { api, ApiError, errorText, useApi } from "../../lib/api";
import { useOverlay } from "../../lib/demo";
import { useColors } from "../../lib/theme";

// Same list as the website's lib/cycleResults.ts.
const STATUSES: [string, string][] = [["APPLIED", "Applied"], ["SECONDARY", "Secondary received"], ["INTERVIEW_INVITE", "Interview invite"], ["INTERVIEWED", "Interviewed"], ["WAITLISTED", "Waitlisted"], ["ACCEPTED", "Accepted"], ["REJECTED", "Rejected"], ["WITHDRAWN", "Withdrawn"], ["MATRICULATING", "Matriculating"]];
const statusLabel = (v: string) => STATUSES.find((s) => s[0] === v)?.[1] || v;
const tone = (v: string) => (v === "ACCEPTED" || v === "MATRICULATING" ? "ok" : v === "REJECTED" || v === "WITHDRAWN" ? "gray" : v === "WAITLISTED" ? "warn" : "plain");
type Result = { id: string; cycle: number; school: string; status: string; note: string | null; mentorIds: string[] };

// Cycle results (/api/me/cycle-results): one row per school.
export default function Results() {
  const { openSheet } = useOverlay();
  const q = useApi<{ results: Result[]; mentors: { id: string; name: string }[] }>("/api/me/cycle-results");
  useRefresh(q.reload);
  const off = q.error && !q.data && /not found/i.test(q.error);
  const edit = (r?: Result) => openSheet(() => <ResultSheet r={r} onSaved={q.reload} />);
  const rows = q.data?.results || [];
  return (
    <Screen>
      <Hdr title="Cycle Results" />
      <Note>Tell us how your cycle went, one school at a time. Mentors see results from their own students only.</Note>
      {q.loading && !q.data ? <Loading /> : null}
      {off ? <Card tone="tint"><Note ink>Cycle results aren’t open yet. We’ll let you know when you can add them.</Note></Card> : q.error && !q.data ? <LoadError error={q.error} onRetry={q.reload} /> : null}
      {q.data ? (
        <>
          {rows.length ? (
            <View>
              {rows.map((r, i) => <Row key={r.id} tt={r.school} ss={`${r.cycle} cycle${r.note ? ` · ${r.note}` : ""}`} rr={<Chip label={statusLabel(r.status)} tone={tone(r.status)} />} onPress={() => edit(r)} last={i === rows.length - 1} />)}
            </View>
          ) : <Note>No schools yet.</Note>}
          <Btn kind="line" label="Add a school" onPress={() => edit()} />
        </>
      ) : null}
    </Screen>
  );
}

function ResultSheet({ r, onSaved }: { r?: Result; onSaved: () => void }) {
  const c = useColors();
  const { closeSheet, toast } = useOverlay();
  const y = new Date().getFullYear();
  const cycles = [y - 1, y, y + 1, y + 2].map(String);
  const [cycle, setCycle] = useState(String(r?.cycle || y + 1));
  const [school, setSchool] = useState(r?.school || "");
  const [status, setStatus] = useState(r?.status || "APPLIED");
  const [note, setNote] = useState(r?.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      closeSheet();
      onSaved();
      toast(done);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const save = () => run(() => api("/api/me/cycle-results", { body: { id: r?.id, cycle: Number(cycle), school: school.trim(), status, note: note.trim(), mentorIds: r?.mentorIds || [] } }), "Saved");
  return (
    <>
      <H>{r ? "Edit School" : "Add a School"}</H>
      <Select label="Cycle (the year you’d start medical school)" options={cycles} value={cycle} onChange={setCycle} />
      <Field label="Medical school" value={school} onChange={setSchool} />
      <Select label="Status" options={STATUSES.map((s) => s[1])} value={statusLabel(status)} onChange={(l) => setStatus(STATUSES.find((s) => s[1] === l)?.[0] || "APPLIED")} />
      <Field label="Note (optional)" value={note} onChange={setNote} multiline />
      {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
      <Btn kind="dark" label={busy ? "Saving…" : "Save"} disabled={busy || !school.trim()} onPress={save} />
      {r ? <Link red label="Remove this school" onPress={() => run(() => api(`/api/me/cycle-results?id=${encodeURIComponent(r.id)}`, { method: "DELETE" }), "Removed")} /> : null}
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
    </>
  );
}
