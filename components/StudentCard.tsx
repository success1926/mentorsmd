"use client";

import { useEffect, useState } from "react";
import { PersonAvatar, MinorBadge } from "@/components/ui";
import { profileLines, type StudentProfile } from "@/lib/studentProfile";

// What a mentor sees about a student (their optional "About you",
// lib/studentProfile.ts): next to the conversation in Messages, on the
// package page and on the call page. Loaded from /api/students/[id]/profile,
// which only answers for a mentor who works with them (or an admin).
type Data = { id: string; name: string; photoUrl: string | null; minor: boolean; profile: StudentProfile; empty: boolean };

// hideName: where the student's name and photo are already shown above it.
export function StudentCard({ studentId, title = "About the student", hideName = false }: { studentId: string; title?: string; hideName?: boolean }) {
  const [d, setD] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setD(null);
    setFailed(false);
    fetch(`/api/students/${studentId}/profile`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((x) => alive && setD(x))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [studentId]);

  if (failed) return null;
  if (!d) return <div className="card text-muted small" style={{ padding: 16 }}>Loading the student&apos;s details…</div>;

  const first = (d.name || "").split(" ")[0] || "The student";
  const l = profileLines(d.profile);
  const facts = [l.applying, l.stage, l.degree, d.profile.school].filter(Boolean) as string[];

  return (
    <section className="card stack-sm" style={{ padding: 16, gap: 10 }} aria-label={title}>
      <b className="small text-secondary">{title}</b>
      {!hideName && (
        <div className="row" style={{ gap: 10 }}>
          <PersonAvatar person={d} size={40} fontSize={15} />
          <div className="stack-sm" style={{ gap: 0, minWidth: 0 }}>
            <b>{d.name}</b>
            {d.minor && <MinorBadge person={{ minorStatus: "MINOR" }} />}
          </div>
        </div>
      )}
      {d.empty ? (
        <span className="text-muted small">{first} hasn&apos;t added details yet. Ask in a message where they are in the process and what they want help with.</span>
      ) : (
        <>
          {facts.length > 0 && (
            <div className="row-wrap" style={{ gap: 6 }}>
              {facts.map((f) => <span key={f} className="badge">{f}</span>)}
            </div>
          )}
          {l.helpWith.length > 0 && (
            <span className="small"><span className="text-secondary">Wants help with:</span> {l.helpWith.join(", ")}</span>
          )}
          {d.profile.about && <p className="small ph-no-capture" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{d.profile.about}</p>}
        </>
      )}
    </section>
  );
}
