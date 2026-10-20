"use client";

import type { ListDef, ScalarDef } from "@/lib/siteContent";
import { ImageFocusEditor } from "@/components/ImageFocusEditor";

// The inputs used by Admin -> Website: one per field type (text, longer
// text, link, photo, one-per-line list) plus a list of cards. The page is
// saved as a draft automatically (app/admin/(panel)/website/[page]/page.tsx).

type Values = Record<string, any>;
const MAX_PHOTO_MB = 8;
// Same value? Key order doesn't matter, and a missing key equals undefined.
const stable = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().filter((k) => (v as any)[k] !== undefined).map((k) => [k, stable((v as any)[k])])) : v;
export const same = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

// "Changed" marker for anything that differs from the live (published) page.
export function ChangedTag() {
  return <span className="ws-changed-tag" title="Different from the live page; publish to make it live">Changed</span>;
}

export function ScalarEditor({ def, value, onChange, compact, changed }: { def: ScalarDef; value: any; onChange: (v: any) => void; compact?: boolean; changed?: boolean }) {
  const label = (
    <span className="field-label">
      {def.label}
      {changed && <ChangedTag />}
    </span>
  );
  const help = def.help ? <span className="field-help">{def.help}</span> : null;
  const cls = `field${changed ? " ws-changed" : ""}`;
  const style = { marginBottom: compact ? 0 : 4 };

  if (def.type === "image") {
    return (
      <div className={cls} style={style}>
        {label}
        {help}
        <ImageFocusEditor value={value || ""} onChange={onChange} uploadEndpoint="/api/admin/website/upload" maxMb={MAX_PHOTO_MB} types={["jpeg", "png", "webp", "gif", "avif"]} />
      </div>
    );
  }
  if (def.type === "choice") {
    return (
      <label className={cls} style={style}>
        {label}
        <select className="input" value={typeof value === "string" && value ? value : def.default} onChange={(e) => onChange(e.target.value)}>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {help}
      </label>
    );
  }
  if (def.type === "lines") {
    const arr: string[] = Array.isArray(value) ? value : [];
    const count = arr.filter((x) => x.trim()).length;
    return (
      <label className={cls} style={style}>
        {label}
        <textarea className="input" rows={Math.min(10, Math.max(3, arr.length + 1))} value={arr.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} />
        <span className="field-help">
          {def.help || "One per line."} {count}/{def.maxItems} lines.
        </span>
      </label>
    );
  }
  const str = typeof value === "string" ? value : "";
  const over = str.length > def.max;
  return (
    <label className={cls} style={style}>
      {label}
      {def.type === "longtext" ? (
        <textarea className="input" rows={Math.min(14, Math.max(3, Math.ceil(str.length / 90) + str.split("\n").length))} value={str} aria-invalid={over} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" value={str} aria-invalid={over} onChange={(e) => onChange(e.target.value)} placeholder={def.type === "link" ? "/mentors or https://…" : undefined} />
      )}
      <span className="field-help" style={over ? { color: "var(--danger)" } : undefined}>
        {def.help ? `${def.help} ` : ""}
        {str.length}/{def.max} characters{"required" in def && def.required ? " · required" : ""}
      </span>
    </label>
  );
}

export function ListEditor({ def, value, live, onChange }: { def: ListDef; value: Values[]; live?: Values[]; onChange: (v: Values[]) => void }) {
  const fields = Object.entries(def.fields as Record<string, ScalarDef>);
  const blank = () => Object.fromEntries(fields.map(([k, f]) => [k, structuredClone(f.default)]));
  const move = (i: number, d: number) => {
    const next = [...value];
    const [it] = next.splice(i, 1);
    next.splice(i + d, 0, it);
    onChange(next);
  };
  const titleOf = (it: Values) => {
    const first = fields.find(([, f]) => f.type === "text");
    const t = first ? String(it[first[0]] || "") : "";
    return t.length > 50 ? t.slice(0, 50) + "…" : t;
  };
  const changedCount = live && live.length !== value.length ? Math.abs(live.length - value.length) : 0;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <span className="field-label">
        {def.label}
        {live && changedCount > 0 && <span className="text-secondary small" style={{ fontWeight: 400 }}> · live page has {live.length}</span>}
      </span>
      {def.help && <span className="field-help">{def.help}</span>}
      {value.length === 0 && <span className="text-muted small">None yet.</span>}
      {value.map((item, i) => {
        const liveItem = live?.[i];
        const itemChanged = !!live && !same(item, liveItem);
        return (
          <details key={i} className={`collapse${itemChanged ? " ws-changed" : ""}`} style={{ marginTop: 0 }}>
            <summary>
              <span>
                {def.itemLabel} {i + 1}
                {titleOf(item) ? <span className="text-secondary" style={{ fontWeight: 400 }}> · {titleOf(item)}</span> : null}
                {itemChanged && <ChangedTag />}
              </span>
            </summary>
            <div className="collapse-body">
              <div className="row-wrap" style={{ gap: 8 }}>
                <button type="button" className="btn btn-soft" style={{ padding: "6px 12px", fontSize: 14 }} disabled={i === 0} onClick={() => move(i, -1)}>↑ Move up</button>
                <button type="button" className="btn btn-soft" style={{ padding: "6px 12px", fontSize: 14 }} disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓ Move down</button>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: "6px 12px", fontSize: 14, color: "var(--danger)" }}
                  onClick={() => {
                    if (confirm(`Remove ${def.itemLabel.toLowerCase()} ${i + 1}?`)) onChange(value.filter((_, j) => j !== i));
                  }}
                >
                  Remove
                </button>
              </div>
              {fields.map(([k, f]) => (
                <ScalarEditor
                  key={k}
                  def={f}
                  value={item[k]}
                  compact
                  changed={!!liveItem && !same(item[k], liveItem[k])}
                  onChange={(v) => onChange(value.map((it, j) => (j === i ? { ...it, [k]: v } : it)))}
                />
              ))}
            </div>
          </details>
        );
      })}
      <button type="button" className="btn btn-soft" style={{ alignSelf: "flex-start" }} disabled={value.length >= def.maxItems} onClick={() => onChange([...value, blank()])}>
        + Add {def.itemLabel.toLowerCase()}
      </button>
    </div>
  );
}
