import { useEffect, useState } from "react";
import { LoadError } from "../../components/shared";
import { Btn, Chips, FChip, Field, Hdr, Loading, Note, Screen, Select, Small } from "../../components/ui";
import { api, errorText, useApi } from "../../lib/api";
import { useOverlay } from "../../lib/demo";
import { useColors } from "../../lib/theme";

// Same lists as the website's lib/studentProfile.ts.
const NONE = "Not set";
const YEARS: [string, string][] = [["2026", "2026"], ["2027", "2027"], ["2028_PLUS", "2028 or later"]];
const STAGES: [string, string][] = [["SCHOOL_LIST", "Building my school list"], ["PERSONAL_STATEMENT", "Personal statement"], ["PRIMARIES", "Primaries"], ["SECONDARIES", "Secondaries"], ["INTERVIEWS", "Interviews"], ["WAITLISTED", "Waitlisted"], ["REAPPLYING", "Reapplying"]];
const DEGREES: [string, string][] = [["MD", "MD"], ["DO", "DO"], ["BOTH", "MD and DO"]];
const HELP: [string, string][] = [["PERSONAL_STATEMENT", "Personal statement"], ["SECONDARIES", "Secondaries"], ["ACTIVITIES", "Activities & experiences"], ["MMI", "MMI prep"], ["TRADITIONAL_INTERVIEW", "Traditional interview prep"], ["SCHOOL_LIST", "School list & strategy"], ["MCAT", "MCAT tutoring"], ["REAPPLICANT", "Reapplicant review"]];
const label = (list: [string, string][], v: string | null) => list.find((x) => x[0] === v)?.[1] || NONE;
const value = (list: [string, string][], l: string) => list.find((x) => x[1] === l)?.[0] || null;

type Profile = { applyYear: string | null; stage: string | null; degree: string | null; school: string | null; helpWith: string[]; about: string | null };

// About you (/api/me/student-profile): only mentors you work with see it.
export default function AboutYou() {
  const c = useColors();
  const { toast } = useOverlay();
  const q = useApi<{ profile: Profile }>("/api/me/student-profile");
  const [p, setP] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (q.data && !p) setP(q.data.profile);
  }, [q.data, p]);
  const set = (patch: Partial<Profile>) => setP((x) => (x ? { ...x, ...patch } : x));
  const save = async () => {
    if (!p) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ profile: Profile }>("/api/me/student-profile", { method: "PATCH", body: { ...p, school: p.school || "", about: p.about || "" } });
      setP(r.profile);
      toast("Saved");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Hdr title="About You" />
      <Note>Mentors you work with see this, so your first call starts in the right place. Every question is optional.</Note>
      {q.loading && !q.data ? <Loading /> : null}
      {q.error && !q.data ? <LoadError error={q.error} onRetry={q.reload} /> : null}
      {p ? (
        <>
          <Select label="When are you applying?" options={[NONE, ...YEARS.map((x) => x[1])]} value={label(YEARS, p.applyYear)} onChange={(l) => set({ applyYear: value(YEARS, l) })} />
          <Select label="Where are you now?" options={[NONE, ...STAGES.map((x) => x[1])]} value={label(STAGES, p.stage)} onChange={(l) => set({ stage: value(STAGES, l) })} />
          <Select label="MD, DO or both?" options={[NONE, ...DEGREES.map((x) => x[1])]} value={label(DEGREES, p.degree)} onChange={(l) => set({ degree: value(DEGREES, l) })} />
          <Field label="College" value={p.school || ""} onChange={(v) => set({ school: v })} />
          <Small>What do you want help with?</Small>
          <Chips>
            {HELP.map(([v, l]) => <FChip key={v} label={l} on={p.helpWith.includes(v)} onPress={() => set({ helpWith: p.helpWith.includes(v) ? p.helpWith.filter((x) => x !== v) : [...p.helpWith, v] })} />)}
          </Chips>
          <Field label="Anything else mentors should know? (300 characters)" value={p.about || ""} onChange={(v) => set({ about: v.slice(0, 300) })} multiline />
          {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
          <Btn kind="dark" label={busy ? "Saving…" : "Save"} disabled={busy} onPress={save} />
        </>
      ) : null}
    </Screen>
  );
}
