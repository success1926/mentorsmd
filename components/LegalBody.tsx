// Shows the text of a legal document written in Admin -> Legal. The
// format is deliberately simple (no HTML, so nothing can be injected):
//   ## Heading      a section heading (# works too)
//   - item          a bullet point
//   blank line      starts a new paragraph
export function LegalBody({ body }: { body: string }) {
  const blocks: { type: "h" | "p" | "ul"; lines: string[] }[] = [];
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ type: "p", lines: [] });
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) {
      blocks.push({ type: "h", lines: [line.replace(/^#{1,3}\s+/, "")] });
    } else if (/^\s*[-*]\s+/.test(line)) {
      const item = line.replace(/^\s*[-*]\s+/, "");
      if (last?.type === "ul") last.lines.push(item);
      else blocks.push({ type: "ul", lines: [item] });
    } else if (last?.type === "p") {
      last.lines.push(line);
    } else {
      blocks.push({ type: "p", lines: [line] });
    }
  }
  return (
    <div className="prose stack" style={{ gap: 14 }}>
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.type === "h" ? (
            <h2 key={i} style={{ fontSize: 22, marginTop: 8 }}>{b.lines[0]}</h2>
          ) : b.type === "ul" ? (
            <ul key={i} className="stack-sm text-secondary" style={{ paddingLeft: 20, lineHeight: 1.6, margin: 0 }}>
              {b.lines.map((l, j) => <li key={j}>{l}</li>)}
            </ul>
          ) : (
            <p key={i} className="text-secondary" style={{ lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{b.lines.join("\n")}</p>
          )
        )}
    </div>
  );
}

export function LegalHeader({ title, version, publishedAt }: { title: string; version: number; publishedAt: Date | string | null }) {
  return (
    <div className="stack-sm" style={{ marginBottom: 24 }}>
      <h1 className="page-title" style={{ textAlign: "left" }}>{title}</h1>
      {version > 0 && (
        <span className="text-muted">
          Version {version}
          {publishedAt ? ` · last updated ${new Date(publishedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}` : ""}
        </span>
      )}
    </div>
  );
}
