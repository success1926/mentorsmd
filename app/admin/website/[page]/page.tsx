"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { upload } from "@vercel/blob/client";
import type { FieldDef, ListDef, ScalarDef } from "@/lib/siteContent";
import { focusPosition, parseFocus, stripFocus, withFocus } from "@/lib/imageFocus";

type Values = Record<string, any>;
type PageData = {
  key: string;
  page: { label: string; path: string; fields: Record<string, FieldDef> };
  defaults: Values;
  values: Values;
  hasDraft: boolean;
  updatedAt: string | null;
  publishedAt: string | null;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const MAX_PHOTO_MB = 8;

// Admin -> Website -> one page: a form grouped by section, with
// Save draft / Preview / Publish / Discard draft.
export default function AdminWebsiteEditPage({ params }: { params: { page: string } }) {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [data, setData] = useState<PageData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [values, setValues] = useState<Values>({});
  const [saved, setSaved] = useState<Values>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string; errors?: string[] } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/website/${params.page}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Couldn't load this page.");
        setData(d);
        setValues(d.values);
        setSaved(d.values);
      })
      .catch((e) => setLoadError(e.message || "Couldn't load this page."));
  }, [params.page]);
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const dirty = !same(values, saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const sections = useMemo(() => {
    const out: { title: string; names: string[] }[] = [];
    for (const [name, f] of Object.entries(data?.page.fields || {})) {
      const title = f.section || "";
      const last = out[out.length - 1];
      if (last && last.title === title) last.names.push(name);
      else out.push({ title, names: [name] });
    }
    return out;
  }, [data]);

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;
  if (loadError) return <div className="page-narrow stack"><Link href="/admin/website" className="link small">← Website</Link><div className="alert alert-danger">{loadError}</div></div>;
  if (!data) return <div className="page text-muted">Loading…</div>;

  async function save(): Promise<boolean> {
    const res = await fetch(`/api/admin/website/${params.page}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice({ ok: false, text: d.error || "Couldn't save.", errors: d.errors });
      return false;
    }
    setSaved(values);
    setData((old) => (old ? { ...old, hasDraft: d.hasDraft } : old));
    return true;
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setNotice(null);
    try {
      await fn();
    } catch {
      setNotice({ ok: false, text: "Something went wrong. Please try again." });
    }
    setBusy(null);
  }

  const onSave = () =>
    run("save", async () => {
      if (await save()) setNotice({ ok: true, text: "Draft saved. Visitors still see the published page until you publish." });
    });

  const onPreview = () => {
    // Opened right away (so the browser doesn't block the new tab), then
    // pointed at the preview once the draft is saved.
    const tab = window.open("about:blank", "_blank");
    run("preview", async () => {
      if (!(await save())) {
        tab?.close();
        return;
      }
      const url = `/api/admin/website/preview?page=${encodeURIComponent(params.page)}`;
      if (tab) tab.location.href = url;
      else window.location.href = url;
    });
  };

  const onPublish = () => {
    if (!confirm(`Publish your changes to the ${data.page.label} page? Everyone will see them.`)) return;
    run("publish", async () => {
      if (!(await save())) return;
      const res = await fetch(`/api/admin/website/${params.page}/publish`, { method: "POST" });
      if (!res.ok) return setNotice({ ok: false, text: "Couldn't publish. Please try again." });
      setNotice({ ok: true, text: "Published. The live site shows your changes now." });
      load();
    });
  };

  const onDiscard = () => {
    if (!confirm("Discard all unpublished changes to this page? It goes back to what's live now.")) return;
    run("discard", async () => {
      const res = await fetch(`/api/admin/website/${params.page}/discard`, { method: "POST" });
      if (!res.ok) return setNotice({ ok: false, text: "Couldn't discard the draft." });
      setNotice({ ok: true, text: "Draft discarded." });
      load();
    });
  };

  const set = (name: string, v: unknown) => setValues((old) => ({ ...old, [name]: v }));
  const unpublished = data.hasDraft || dirty;

  return (
    <div className="page stack-lg" style={{ gap: 28, maxWidth: 980 }}>
      <div className="row-wrap" style={{ gap: 16 }}>
        <Link href="/admin" className="link small">← Admin</Link>
        <Link href="/admin/website" className="link small">All website pages</Link>
      </div>
      <div className="stack-sm">
        <h1 className="page-title">{data.page.label}</h1>
        <p className="lede">
          {params.page === "footer" ? "The bottom of every page." : <>The page at <a className="link" href={data.page.path} target="_blank" rel="noreferrer">{data.page.path}</a>.</>}{" "}
          Text shows exactly as typed (no formatting codes); a line break starts a new paragraph.
        </p>
      </div>

      <div
        className="card row-wrap"
        style={{ gap: 10, position: "sticky", top: 90, zIndex: 20, alignItems: "center", boxShadow: "0 6px 24px rgba(27,24,52,0.08)" }}
      >
        {dirty ? (
          <span className="badge badge-warning">Changes not saved yet</span>
        ) : unpublished ? (
          <span className="badge badge-pink">Draft saved, not published</span>
        ) : (
          <span className="badge badge-success">Live page is up to date</span>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-soft" disabled={!!busy || !dirty} onClick={onSave}>{busy === "save" ? "Saving…" : "Save draft"}</button>
        <button type="button" className="btn btn-soft" disabled={!!busy} onClick={onPreview}>{busy === "preview" ? "Opening…" : "Preview"}</button>
        <button type="button" className="btn btn-primary" disabled={!!busy || !unpublished} onClick={onPublish}>{busy === "publish" ? "Publishing…" : "Publish"}</button>
        <button type="button" className="btn" disabled={!!busy || !data.hasDraft} onClick={onDiscard}>Discard draft</button>
      </div>

      {notice && (
        <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>
          {notice.text}
          {notice.errors && notice.errors.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              {notice.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {sections.map((s) => (
        <section key={s.title} className="card stack" style={{ gap: 18 }}>
          {s.title && <h2 style={{ fontSize: 22 }}>{s.title}</h2>}
          {s.names.map((name) => {
            const f = data.page.fields[name];
            const changed = !same(values[name], data.defaults[name]);
            return (
              <div key={name} className="stack-sm" style={{ gap: 6 }}>
                {f.type === "list" ? (
                  <ListEditor def={f as ListDef} value={values[name] || []} onChange={(v) => set(name, v)} />
                ) : (
                  <ScalarEditor def={f as ScalarDef} value={values[name]} onChange={(v) => set(name, v)} />
                )}
                {changed && (
                  <button
                    type="button"
                    className="link small"
                    style={{ alignSelf: "flex-start", background: "none", border: 0, padding: 0, cursor: "pointer" }}
                    onClick={() => {
                      if (confirm(`Put “${f.label}” back to the built-in default?`)) set(name, structuredClone(data.defaults[name]));
                    }}
                  >
                    Reset to default
                  </button>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function ScalarEditor({ def, value, onChange, compact }: { def: ScalarDef; value: any; onChange: (v: any) => void; compact?: boolean }) {
  const label = <span className="field-label">{def.label}</span>;
  const help = def.help ? <span className="field-help">{def.help}</span> : null;

  if (def.type === "image") {
    return (
      <div className="field" style={{ marginBottom: compact ? 0 : 4 }}>
        {label}
        {help}
        <ImageEditor value={value || ""} onChange={onChange} />
      </div>
    );
  }
  if (def.type === "lines") {
    const arr: string[] = Array.isArray(value) ? value : [];
    const count = arr.filter((x) => x.trim()).length;
    return (
      <label className="field" style={{ marginBottom: compact ? 0 : 4 }}>
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
    <label className="field" style={{ marginBottom: compact ? 0 : 4 }}>
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

function ListEditor({ def, value, onChange }: { def: ListDef; value: Values[]; onChange: (v: Values[]) => void }) {
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
  return (
    <div className="stack" style={{ gap: 12 }}>
      <span className="field-label">{def.label}</span>
      {def.help && <span className="field-help">{def.help}</span>}
      {value.length === 0 && <span className="text-muted small">None yet.</span>}
      {value.map((item, i) => (
        <details key={i} className="collapse" style={{ marginTop: 0 }}>
          <summary>
            <span>
              {def.itemLabel} {i + 1}
              {titleOf(item) ? <span className="text-secondary" style={{ fontWeight: 400 }}> · {titleOf(item)}</span> : null}
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
              <ScalarEditor key={k} def={f} value={item[k]} compact onChange={(v) => onChange(value.map((it, j) => (j === i ? { ...it, [k]: v } : it)))} />
            ))}
          </div>
        </details>
      ))}
      <button type="button" className="btn btn-soft" style={{ alignSelf: "flex-start" }} disabled={value.length >= def.maxItems} onClick={() => onChange([...value, blank()])}>
        + Add {def.itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

// Upload a photo and click on it to set the focus point (the part that
// stays in view when the photo is cropped).
function ImageEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const src = stripFocus(value);
  const focus = parseFocus(value);

  async function pick(file: File) {
    setError("");
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return setError("Please choose a JPG, PNG, WebP, GIF or AVIF photo.");
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return setError(`That photo is over ${MAX_PHOTO_MB}MB. Please choose a smaller one.`);
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z]/g, "") || "jpg";
      const base = file.name.replace(/\.[^.]+$/, "").slice(0, 80).replace(/[^a-zA-Z0-9_-]+/g, "_") || "photo";
      const blob = await upload(`site/${base}.${ext}`, file, { access: "public", handleUploadUrl: "/api/admin/website/upload", contentType: file.type });
      onChange(blob.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    }
    setUploading(false);
  }

  function setFocus(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    onChange(withFocus(src, { x, y }));
  }

  return (
    <div className="stack-sm" style={{ gap: 10 }}>
      {src ? (
        <div className="row-wrap" style={{ gap: 16, alignItems: "flex-start" }}>
          <div className="stack-sm" style={{ gap: 4 }}>
            <div onClick={setFocus} style={{ position: "relative", cursor: "crosshair", maxWidth: 360, lineHeight: 0, borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)" }} title="Click the most important part of the photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" style={{ maxWidth: 360, maxHeight: 280, width: "auto", height: "auto", display: "block" }} />
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: `${focus?.x ?? 50}%`,
                  top: `${focus?.y ?? 50}%`,
                  width: 22,
                  height: 22,
                  marginLeft: -11,
                  marginTop: -11,
                  borderRadius: 999,
                  border: "3px solid #fff",
                  background: "rgba(85,54,214,0.75)",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
                  opacity: focus ? 1 : 0.5,
                }}
              />
            </div>
            <span className="field-help">Click the most important part (e.g. a face). It stays in view when the photo is cropped.</span>
          </div>
          <div className="stack-sm" style={{ gap: 6 }}>
            <span className="field-help">How it crops:</span>
            <div className="row" style={{ gap: 8 }}>
              {[
                { w: 80, h: 100 },
                { w: 120, h: 120 },
                { w: 180, h: 100 },
              ].map((b, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" style={{ width: b.w, height: b.h, objectFit: "cover", objectPosition: focusPosition(value), borderRadius: 8, border: "1px solid var(--line)" }} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <span className="text-muted small">No photo.</span>
      )}
      <div className="row-wrap" style={{ gap: 8 }}>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        <button type="button" className="btn btn-soft" disabled={uploading} onClick={() => input.current?.click()}>
          {uploading ? "Uploading…" : src ? "Replace photo" : "Upload photo"}
        </button>
        {src && focus && <button type="button" className="btn" onClick={() => onChange(src)}>Clear focus point</button>}
        {src && <button type="button" className="btn" style={{ color: "var(--danger)" }} onClick={() => onChange("")}>Remove photo</button>}
      </div>
      <span className="field-help">JPG, PNG, WebP, GIF or AVIF, up to {MAX_PHOTO_MB}MB.</span>
      {error && <span className="field-help" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
