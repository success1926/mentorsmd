"use client";

import { useState } from "react";
import type { ListDef, ScalarDef } from "@/lib/siteContent";
import { ADDON_TYPES, MAX_ADDONS, SPACE_OPTIONS, isAddonType, newAddonId, sectionLabel, sectionsFor, type AddonType, type LayoutItem } from "@/lib/pageLayout";
import { ChangedTag, ListEditor, ScalarEditor, same } from "@/components/website/FieldEditors";

// Admin -> Website -> (page) -> Layout tab: the page's sections top to
// bottom. Move them, hide/show them, choose the space above, add sections
// (text, photo with text, FAQ, banner, video, logos), edit and remove the
// added ones. The page's own sections are edited on the Content tab.
export function LayoutEditor({
  page,
  value,
  live,
  onChange,
}: {
  page: string;
  value: LayoutItem[];
  live: LayoutItem[];
  onChange: (next: LayoutItem[]) => void;
}) {
  const builtins = sectionsFor(page);
  const [adding, setAdding] = useState<AddonType>("text");
  const addons = value.filter((i) => !builtins.some((b) => b.id === i.id)).length;

  const update = (i: number, patch: Partial<LayoutItem>) =>
    onChange(
      value.map((x, n) => {
        if (n !== i) return x;
        const next: LayoutItem = { ...x, ...patch };
        if (!next.hidden) delete next.hidden;
        if (!next.space) delete next.space;
        return next;
      }),
    );
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => {
    const def = ADDON_TYPES[adding];
    const data = Object.fromEntries(Object.entries(def.fields).map(([k, f]) => [k, structuredClone(f.default)]));
    const item: LayoutItem = { id: newAddonId(), type: adding, data };
    onChange([...value, item]);
    // Open the new section's fields once it's on screen.
    window.setTimeout(() => {
      const el = document.getElementById(`ws-lay-${item.id}`) as HTMLDetailsElement | null;
      if (el) {
        el.open = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 60);
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="text-secondary" style={{ fontSize: 15 }}>
        Top to bottom, the order of this page. Hidden sections stay saved; show them again any time. “Space above” gives a section a little less or more room.
        The page&apos;s own sections are edited on the Content tab; sections you add are edited here.
      </p>
      <ol className="ws-layout">
        {value.map((it, i) => {
          const builtin = builtins.find((b) => b.id === it.id);
          const label = sectionLabel(page, it);
          const liveIndex = live.findIndex((l) => l.id === it.id);
          const liveItem = liveIndex >= 0 ? live[liveIndex] : undefined;
          const changed = !liveItem || !same(it, liveItem) || liveIndex !== i;
          const title = typeof it.data?.title === "string" ? it.data.title : typeof it.data?.label === "string" ? it.data.label : "";
          const row = (
            <span className="ws-layout-row">
              <span className="ws-layout-name" style={{ opacity: it.hidden ? 0.55 : 1 }}>
                {!builtin && <span className="badge badge-brand" style={{ marginRight: 8, fontSize: 12, padding: "2px 8px" }}>Added</span>}
                {label}
                {title && <span className="text-secondary" style={{ fontWeight: 400 }}> · {title.length > 40 ? title.slice(0, 40) + "…" : title}</span>}
                {it.hidden && <span className="text-secondary" style={{ fontWeight: 400 }}> (hidden)</span>}
                {changed && <ChangedTag />}
              </span>
              <span className="ws-layout-tools">
                <button type="button" aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" aria-label={`Move ${label} down`} disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓</button>
                <select
                  className="input"
                  aria-label={`Space above ${label}`}
                  value={it.space ?? ""}
                  onChange={(e) => update(i, { space: (e.target.value || undefined) as LayoutItem["space"] })}
                >
                  {SPACE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                {builtin?.keepVisible ? (
                  <span className="text-muted small" title="Other pages link to this section, so it always shows.">Always shown</span>
                ) : (
                  <button type="button" onClick={() => update(i, { hidden: !it.hidden })}>{it.hidden ? "Show" : "Hide"}</button>
                )}
                {!builtin && (
                  <button
                    type="button"
                    className="ws-layout-remove"
                    aria-label={`Remove ${label}`}
                    onClick={() => {
                      if (confirm(`Remove this “${label}” section? Its text goes too.`)) onChange(value.filter((_, n) => n !== i));
                    }}
                  >
                    Remove
                  </button>
                )}
              </span>
            </span>
          );
          if (builtin || !it.type || !isAddonType(it.type)) {
            return (
              <li key={it.id} id={`ws-lay-${it.id}`} className={`ws-layout-item${changed ? " ws-changed" : ""}`}>
                {row}
              </li>
            );
          }
          const def = ADDON_TYPES[it.type];
          const data = it.data ?? {};
          const liveData = liveItem?.data;
          const setField = (k: string, v: unknown) => update(i, { data: { ...data, [k]: v } });
          return (
            <li key={it.id} className={`ws-layout-item${changed ? " ws-changed" : ""}`}>
              {row}
              <details id={`ws-lay-${it.id}`} className="ws-layout-fields">
                <summary>Edit this section</summary>
                <div className="stack" style={{ gap: 14, paddingTop: 14 }}>
                  <span className="field-help">{def.help}</span>
                  {Object.entries(def.fields).map(([k, f]) =>
                    f.type === "list" ? (
                      <ListEditor key={k} def={f as ListDef} value={(data[k] as any[]) || []} live={liveData ? (liveData[k] as any[]) || [] : undefined} onChange={(v) => setField(k, v)} />
                    ) : (
                      <ScalarEditor key={k} def={f as ScalarDef} value={data[k]} compact changed={!!liveData && !same(data[k], liveData[k])} onChange={(v) => setField(k, v)} />
                    ),
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
      <div className="row-wrap" style={{ gap: 10, alignItems: "center" }}>
        <select className="input" style={{ maxWidth: 280 }} aria-label="Kind of section to add" value={adding} onChange={(e) => setAdding(e.target.value as AddonType)}>
          {(Object.keys(ADDON_TYPES) as AddonType[]).map((k) => (
            <option key={k} value={k}>{ADDON_TYPES[k].label}</option>
          ))}
        </select>
        <button type="button" className="btn btn-soft" disabled={addons >= MAX_ADDONS} onClick={add}>+ Add a section</button>
        <span className="text-muted small">Added at the bottom; move it with the arrows.</span>
      </div>
    </div>
  );
}
