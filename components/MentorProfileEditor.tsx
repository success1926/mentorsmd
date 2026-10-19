"use client";

import { useState } from "react";
import {
  ADMISSIONS_ROLE_TYPES,
  BEST_FOR,
  LANGUAGE_LEVELS,
  PROFILE_RULES as R,
  STRONGEST_STAGES,
  countWords,
} from "@/lib/options";
import { languagesOf, rolesOf, type AdmissionsRole, type Language } from "@/lib/profileCompleteness";

// The mentor profile sections on the Account page (docs/redesign-2026-10.md
// section 2): bio, admissions experience, clinical & research, who you're
// best for, credentials & highlights, known for, languages and a fun fact.
// Every section has its own Save button, and each one saves the whole
// editor, so nothing typed elsewhere is lost. The checklist above it
// (components/ProfileChecklist.tsx) says what's still missing.

type State = {
  bio: string;
  admissionsRoles: AdmissionsRole[];
  yearsAdvising: string;
  applicantsSupported: string;
  strongestStages: string[];
  specialtyInterest: string;
  researchSummary: string;
  bestFor: string[];
  bestForOther: string;
  highlights: string[];
  knownFor: string[];
  languages: Language[];
  funFact: string;
};

const numText = (n: unknown) => (typeof n === "number" ? String(n) : "");

function initialState(p: any): State {
  const highlights: string[] = Array.isArray(p.highlights) ? p.highlights : [];
  const knownFor: string[] = Array.isArray(p.knownFor) ? p.knownFor : [];
  return {
    bio: p.bio || "",
    admissionsRoles: rolesOf(p.admissionsRoles),
    yearsAdvising: numText(p.yearsAdvising),
    applicantsSupported: numText(p.applicantsSupported),
    strongestStages: p.strongestStages || [],
    specialtyInterest: p.specialtyInterest || "",
    researchSummary: p.researchSummary || "",
    bestFor: p.bestFor || [],
    bestForOther: p.bestForOther || "",
    // Always show at least the minimum number of rows to fill in.
    highlights: highlights.length >= R.highlightsMin ? highlights : [...highlights, ...Array(R.highlightsMin - highlights.length).fill("")],
    knownFor: Array.from({ length: R.knownForCount }, (_, i) => knownFor[i] || ""),
    languages: languagesOf(p.languages).length ? languagesOf(p.languages) : [{ name: "English", level: "NATIVE", canAdvise: true }],
    funFact: p.funFact || "",
  };
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Counter({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span className="field-help" style={{ color: ok ? "var(--success-fg)" : undefined }}>{children}</span>;
}

function Section({ id, title, help, children, onSave, saving, msg }: {
  id: string;
  title: string;
  help: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  msg: { ok: boolean; text: string } | null;
}) {
  return (
    <section id={id} className="card stack" style={{ scrollMarginTop: 100 }} aria-labelledby={`${id}-title`}>
      <div className="stack-sm">
        <h2 id={`${id}-title`} style={{ fontSize: 24 }}>{title}</h2>
        <span className="text-secondary">{help}</span>
      </div>
      {children}
      <div className="row-wrap">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={onSave}>{saving ? "Saving…" : "Save"}</button>
        {msg && <span role="status" className="small" style={{ color: msg.ok ? "var(--success-fg)" : "var(--danger)" }}>{msg.text}</span>}
      </div>
    </section>
  );
}

export function MentorProfileEditor({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [s, setS] = useState<State>(() => initialState(profile));
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ section: string; ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));

  const bioWords = countWords(s.bio);
  const researchWords = countWords(s.researchSummary);
  const highlightCount = s.highlights.filter((h) => h.trim()).length;
  const knownCount = s.knownFor.filter((h) => h.trim()).length;

  async function save(section: string) {
    setSaving(section);
    setMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio: s.bio,
        admissionsRoles: s.admissionsRoles,
        yearsAdvising: s.yearsAdvising.trim() === "" ? null : Number(s.yearsAdvising),
        applicantsSupported: s.applicantsSupported.trim() === "" ? null : Number(s.applicantsSupported),
        strongestStages: s.strongestStages,
        specialtyInterest: s.specialtyInterest,
        researchSummary: s.researchSummary,
        bestFor: s.bestFor,
        bestForOther: s.bestForOther,
        highlights: s.highlights,
        knownFor: s.knownFor,
        languages: s.languages,
        funFact: s.funFact,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(null);
    setMsg({ section, ok: res.ok, text: res.ok ? "Saved." : d.error || "Couldn't save" });
    if (res.ok) onSaved();
  }
  const sectionProps = (id: string) => ({ id, onSave: () => save(id), saving: saving !== null, msg: msg?.section === id ? msg : null });

  return (
    <div className="stack-lg" style={{ gap: 24 }}>
      <Section {...sectionProps("bio")} title="Bio" help="The paragraph students read first, next to your photo. 3 or 4 sentences: your path to medicine, what you help with most, and who you love working with.">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Bio</span>
          <textarea
            className="input"
            style={{ minHeight: 150 }}
            maxLength={3000}
            value={s.bio}
            onChange={(e) => set({ bio: e.target.value })}
            placeholder="I'm an MS3 who sat on my school's admissions committee for two cycles. I love helping students who think their story isn't 'medical enough' find the thread that ties it together…"
          />
          <Counter ok={bioWords >= R.bioMinWords}>{bioWords} / {R.bioMinWords} words minimum</Counter>
        </label>
      </Section>

      <Section {...sectionProps("admissions")} title="Admissions experience" help="Roles you've had on the admissions side, and how much advising you've done. Students trust specifics: say where and when.">
        <div className="stack-sm">
          <span className="field-label">Admissions roles</span>
          {s.admissionsRoles.length === 0 && <span className="text-muted small">No roles yet. Add committee, interviewer or screener roles below.</span>}
          {s.admissionsRoles.map((r, i) => (
            <div key={i} className="row-wrap" style={{ alignItems: "flex-end", gap: 8, padding: 12, borderRadius: 12, background: "var(--tint-soft)" }}>
              <label className="field" style={{ marginBottom: 0, minWidth: 170 }}>
                <span className="field-help">Role</span>
                <select className="input" value={r.type} onChange={(e) => set({ admissionsRoles: s.admissionsRoles.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}>
                  {ADMISSIONS_ROLE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="field grow" style={{ marginBottom: 0, minWidth: 160 }}>
                <span className="field-help">Where (optional)</span>
                <input className="input" maxLength={R.shortMax} value={r.place} placeholder="e.g. my medical school" onChange={(e) => set({ admissionsRoles: s.admissionsRoles.map((x, j) => (j === i ? { ...x, place: e.target.value } : x)) })} />
              </label>
              <label className="field" style={{ marginBottom: 0, width: 140 }}>
                <span className="field-help">Years</span>
                <input className="input" maxLength={40} value={r.years} placeholder="2023 to 2025" onChange={(e) => set({ admissionsRoles: s.admissionsRoles.map((x, j) => (j === i ? { ...x, years: e.target.value } : x)) })} />
              </label>
              <label className="check" style={{ paddingBottom: 10 }}>
                <input type="checkbox" checked={r.former} onChange={(e) => set({ admissionsRoles: s.admissionsRoles.map((x, j) => (j === i ? { ...x, former: e.target.checked } : x)) })} />
                Former
              </label>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove role ${i + 1}`} onClick={() => set({ admissionsRoles: s.admissionsRoles.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-soft btn-sm"
            style={{ alignSelf: "flex-start" }}
            disabled={s.admissionsRoles.length >= R.rolesMax}
            onClick={() => set({ admissionsRoles: [...s.admissionsRoles, { type: "INTERVIEWER", place: "", years: "", former: false }] })}
          >
            + Add a role
          </button>
        </div>
        <div className="grid-2">
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Years advising applicants</span>
            <input className="input" type="number" min={0} max={60} step={1} value={s.yearsAdvising} onChange={(e) => set({ yearsAdvising: e.target.value })} placeholder="3" />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Applicants you&apos;ve helped (about)</span>
            <input className="input" type="number" min={0} step={1} value={s.applicantsSupported} onChange={(e) => set({ applicantsSupported: e.target.value })} placeholder="40" />
          </label>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Strongest stages (pick at least one)</span>
          <div className="seg" role="group" aria-label="Strongest stages">
            {STRONGEST_STAGES.map((o) => (
              <button type="button" key={o.value} className="seg-opt" aria-pressed={s.strongestStages.includes(o.value)} onClick={() => set({ strongestStages: toggle(s.strongestStages, o.value) })}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section {...sectionProps("clinical")} title="Clinical & research" help="What you're drawn to clinically, and your research in 3 or 4 sentences: the questions, what you found, anything published or presented.">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Specialty interest</span>
          <input className="input" maxLength={R.shortMax} value={s.specialtyInterest} onChange={(e) => set({ specialtyInterest: e.target.value })} placeholder="e.g. Pediatric cardiology" />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Research interests and accomplishments</span>
          <textarea className="input" style={{ minHeight: 120 }} maxLength={R.textMax} value={s.researchSummary} onChange={(e) => set({ researchSummary: e.target.value })} />
          <Counter ok={researchWords >= R.researchMinWords}>{researchWords} / {R.researchMinWords} words minimum</Counter>
        </label>
      </Section>

      <Section {...sectionProps("best-for")} title="Who you're best for" help="The students you help most. Students filter Browse mentors by these, so tick every one that's true (at least one).">
        <div className="grid-2" style={{ gap: 4 }}>
          {BEST_FOR.map((o) => (
            <label key={o.value} className="check">
              <input type="checkbox" checked={s.bestFor.includes(o.value)} onChange={() => set({ bestFor: toggle(s.bestFor, o.value) })} />
              {o.label}
            </label>
          ))}
        </div>
        <label className="field" style={{ marginBottom: 0, maxWidth: 420 }}>
          <span className="field-label">Other (optional)</span>
          <input className="input" maxLength={60} value={s.bestForOther} onChange={(e) => set({ bestForOther: e.target.value })} placeholder="e.g. Military applicants" />
        </label>
      </Section>

      <Section {...sectionProps("highlights")} title="Credentials & highlights" help={`${R.highlightsMin} to ${R.highlightsMax} short bullets: awards, leadership, publications, scores if you want to share them (MCAT or USMLE percentile is optional).`}>
        <div className="stack-sm">
          {s.highlights.map((h, i) => (
            <div key={i} className="row" style={{ gap: 8 }}>
              <span aria-hidden="true" className="text-muted">•</span>
              <input className="input grow" style={{ marginBottom: 0 }} aria-label={`Highlight ${i + 1}`} maxLength={R.shortMax} value={h} onChange={(e) => set({ highlights: s.highlights.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove highlight ${i + 1}`} onClick={() => set({ highlights: s.highlights.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <div className="row-wrap">
            <button type="button" className="btn btn-soft btn-sm" disabled={s.highlights.length >= R.highlightsMax} onClick={() => set({ highlights: [...s.highlights, ""] })}>+ Add a bullet</button>
            <Counter ok={highlightCount >= R.highlightsMin && highlightCount <= R.highlightsMax}>{highlightCount} of {R.highlightsMin} to {R.highlightsMax} bullets</Counter>
          </div>
        </div>
      </Section>

      <Section {...sectionProps("known-for")} title="Known for" help={`Exactly ${R.knownForCount} short bullets: what students say you're great at. Keep each one to a few words.`}>
        <div className="stack-sm">
          {s.knownFor.map((h, i) => (
            <div key={i} className="row" style={{ gap: 8 }}>
              <span aria-hidden="true" className="text-muted">{i + 1}.</span>
              <input className="input grow" style={{ marginBottom: 0 }} aria-label={`Known for ${i + 1}`} maxLength={R.knownForMax} value={h} placeholder={["Turning activity lists into stories", "Calm, honest interview feedback", "Fast, detailed essay edits"][i]} onChange={(e) => set({ knownFor: s.knownFor.map((x, j) => (j === i ? e.target.value : x)) })} />
            </div>
          ))}
          <Counter ok={knownCount === R.knownForCount}>{knownCount} of {R.knownForCount} bullets</Counter>
        </div>
      </Section>

      <Section {...sectionProps("languages")} title="Languages" help="Every language you speak, how well, and whether you can advise students in it. Languages you can advise in show on your profile.">
        <div className="stack-sm">
          {s.languages.map((l, i) => (
            <div key={i} className="row-wrap" style={{ gap: 8, alignItems: "flex-end" }}>
              <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
                <span className="field-help">Language</span>
                <input className="input" maxLength={40} value={l.name} onChange={(e) => set({ languages: s.languages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              </label>
              <label className="field" style={{ marginBottom: 0, minWidth: 150 }}>
                <span className="field-help">Level</span>
                <select className="input" value={l.level} onChange={(e) => set({ languages: s.languages.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)) })}>
                  {LANGUAGE_LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="check" style={{ paddingBottom: 10 }}>
                <input type="checkbox" checked={l.canAdvise} onChange={(e) => set({ languages: s.languages.map((x, j) => (j === i ? { ...x, canAdvise: e.target.checked } : x)) })} />
                Can advise in it
              </label>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${l.name || "language"}`} onClick={() => set({ languages: s.languages.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-soft btn-sm" style={{ alignSelf: "flex-start" }} disabled={s.languages.length >= R.languagesMax} onClick={() => set({ languages: [...s.languages, { name: "", level: "FLUENT", canAdvise: true }] })}>
            + Add a language
          </button>
        </div>
      </Section>

      <Section {...sectionProps("fun-fact")} title="Fun fact" help="One or two sentences that make you human: a hobby, a hidden talent, the strangest job you've had.">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Fun fact</span>
          <textarea className="input" style={{ minHeight: 80 }} maxLength={R.funFactMax} value={s.funFact} onChange={(e) => set({ funFact: e.target.value })} />
          <span className="field-help">{s.funFact.length} / {R.funFactMax} characters</span>
        </label>
      </Section>
    </div>
  );
}
