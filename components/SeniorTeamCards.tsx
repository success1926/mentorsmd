"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

// Senior team cards (laid out like the AdmitMD leadership cards): photo on
// top, name, title, credentials and the first bio paragraph; the whole card
// opens the full bio in a pop-up with Previous / Next.
export type SeniorPerson = {
  name: string;
  title: string;
  creds: string;
  photo: string; // address without the focus point
  photoPosition: string; // CSS object-position from the focus point
  bio: string[];
  focus: string[];
};

export function SeniorTeamCards({ people }: { people: SeniorPerson[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const p = open === null ? null : people[open];
  const many = people.length > 1;
  const step = (d: number) => setOpen((i) => (i === null ? i : (i + d + people.length) % people.length));

  return (
    <>
      <div className="lead-grid">
        {people.map((person, i) => (
          <button key={i} type="button" className="lead-card" aria-haspopup="dialog" aria-label={`Read full bio for ${person.name}`} onClick={() => setOpen(i)}>
            <span className="lead-photo" aria-hidden="true">
              {person.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={person.photo} alt="" style={{ objectPosition: person.photoPosition }} />
              )}
            </span>
            <span className="lead-body">
              <span className="lead-name">{person.name}</span>
              {person.title && <span className="lead-title">{person.title}</span>}
              {person.creds && <span className="lead-creds">{person.creds}</span>}
              {person.bio[0] && <span className="lead-intro">{person.bio[0]}</span>}
              <span className="lead-more">
                Read full bio <span className="lead-plus" aria-hidden="true">+</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <Modal open={p !== null} onClose={() => setOpen(null)} label={p ? `Bio of ${p.name}` : "Bio"} wide>
        {p && (
          <div className="lead-bio">
            {p.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo} alt={`Photo of ${p.name}`} className="lead-bio-photo" style={{ objectPosition: p.photoPosition }} />
            )}
            <div className="stack" style={{ gap: 14, minWidth: 0 }}>
              <div className="stack" style={{ gap: 4, paddingRight: 32 }}>
                <h2 style={{ fontSize: 32 }}>{p.name}</h2>
                {p.title && <span className="lead-title">{p.title}</span>}
                {p.creds && <span className="lead-creds">{p.creds}</span>}
              </div>
              {p.bio.map((para, i) => (
                <p key={i} style={{ lineHeight: 1.65 }}>{para}</p>
              ))}
              {p.focus.length > 0 && (
                <div className="row-wrap" style={{ gap: 8 }}>
                  {p.focus.map((f, j) => (
                    <span key={j} className="chip" style={{ fontSize: 14, padding: "6px 14px" }}>{f}</span>
                  ))}
                </div>
              )}
              {many && (
                <div className="lead-steps">
                  <button type="button" className="btn btn-ghost" onClick={() => step(-1)} aria-label="Previous bio">‹ Previous</button>
                  <span className="text-secondary" aria-live="polite" style={{ fontSize: 14 }}>
                    {(open ?? 0) + 1} of {people.length}
                  </span>
                  <button type="button" className="btn btn-ghost" onClick={() => step(1)} aria-label="Next bio">Next ›</button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
