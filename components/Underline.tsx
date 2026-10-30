// A heading with one phrase underlined by a hand-drawn purple line (as on AdmitMD).
// The phrase is matched ignoring case and curly/straight apostrophes; when it isn't
// in the text (or is blank) the heading shows plain. Line breaks in the text start
// a new line.
import { Fragment } from "react";

const norm = (s: string) => s.replace(/[‘’]/g, "'").toLowerCase();

export function Underline({ text, phrase }: { text: string; phrase?: string }) {
  const p = phrase?.trim();
  const at = p ? norm(text).indexOf(norm(p)) : -1;
  if (!p || at < 0) return <Lines text={text} />;
  return (
    <>
      <Lines text={text.slice(0, at)} />
      <span className="underlined">
        {text.slice(at, at + p.length)}
        <svg viewBox="0 0 300 22" preserveAspectRatio="none" aria-hidden="true">
          <path d="M4 14 C 70 6, 160 18, 296 8" stroke="var(--primary)" strokeWidth={4.5} strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
      </span>
      <Lines text={text.slice(at + p.length)} />
    </>
  );
}

function Lines({ text }: { text: string }) {
  const parts = text.split("\n");
  return (
    <>
      {parts.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {l}
        </Fragment>
      ))}
    </>
  );
}
