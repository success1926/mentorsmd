"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { FieldDef, ListDef, ScalarDef } from "@/lib/siteContent";
import { ChangedTag, ListEditor, ScalarEditor, same } from "@/components/website/FieldEditors";
import { EditorPreview, type EditorPreviewHandle } from "@/components/website/EditorPreview";

type Values = Record<string, any>;
type PageData = {
  key: string;
  page: { label: string; path: string; fields: Record<string, FieldDef> };
  defaults: Values;
  live: Values;
  values: Values;
  hasDraft: boolean;
  updatedAt: string | null;
  publishedAt: string | null;
};
type SaveState = "idle" | "pending" | "error";

const AUTOSAVE_MS = 1000;
const WIDE = "(min-width: 1200px)";
const PREVIEW_KEY = "mmd-site-preview-open";

// Admin -> Website -> one page: a form grouped by section. Every change is
// saved as a draft automatically about a second after typing stops; the
// live site only changes on Publish. On wide screens the draft shows in a
// preview panel beside the form, reloaded after each save.
export default function AdminWebsiteEditPage({ params }: { params: { page: string } }) {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [data, setData] = useState<PageData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [values, setValues] = useState<Values>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveErrors, setSaveErrors] = useState<{ text: string; errors?: string[] } | null>(null);

  // Autosave bookkeeping: every change bumps `rev`; a save remembers the rev
  // it sent. Saves go out one at a time, in order, so an older save can
  // never land after a newer one.
  const latest = useRef<Values>({});
  const rev = useRef(0);
  const savedRev = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const preview = useRef<EditorPreviewHandle>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/website/${params.page}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Couldn't load this page.");
        setData(d);
        setValues(d.values);
        latest.current = d.values;
        savedRev.current = rev.current;
        setSaveState("idle");
        setSaveErrors(null);
      })
      .catch((e) => setLoadError(e.message || "Couldn't load this page."));
  }, [params.page]);
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const saveNow = useCallback((): Promise<boolean> => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const sentRev = rev.current;
    const body = JSON.stringify({ values: latest.current });
    setSaveState("pending");
    const run = chain.current.then(async (): Promise<boolean> => {
      let ok = false;
      let problem: { text: string; errors?: string[] } | null = null;
      let hasDraft: boolean | undefined;
      try {
        const res = await fetch(`/api/admin/website/${params.page}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body });
        const d = await res.json().catch(() => ({}));
        if (res.ok) {
          ok = true;
          hasDraft = !!d.hasDraft;
        } else problem = { text: d.error || "Couldn't save.", errors: d.errors };
      } catch {
        problem = { text: "Couldn't reach the server. Check your connection." };
      }
      if (ok) savedRev.current = Math.max(savedRev.current, sentRev);
      if (hasDraft !== undefined) setData((old) => (old ? { ...old, hasDraft: hasDraft! } : old));
      // Only the newest save decides what the status line says.
      if (sentRev === rev.current && timer.current === undefined) {
        setSaveState(ok ? "idle" : "error");
        setSaveErrors(problem);
        if (ok) preview.current?.reload();
      }
      return ok;
    });
    chain.current = run.catch(() => {});
    return run;
  }, [params.page]);

  // Saves anything not saved yet (before Publish or Preview).
  const flush = useCallback(async (): Promise<boolean> => {
    if (rev.current !== savedRev.current || timer.current !== undefined) return saveNow();
    await chain.current;
    return rev.current === savedRev.current;
  }, [saveNow]);

  const change = (name: string, v: unknown) => {
    const next = { ...latest.current, [name]: v };
    latest.current = next;
    setValues(next);
    rev.current++;
    setSaveState("pending");
    setNotice(null);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      saveNow();
    }, AUTOSAVE_MS);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Warn before leaving only while a change hasn't been saved yet.
  const unsaved = saveState !== "idle";
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // Live preview beside the form on wide screens (can be hidden).
  const [wide, setWide] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    try {
      setPreviewOpen(localStorage.getItem(PREVIEW_KEY) !== "0");
    } catch {}
    return () => mq.removeEventListener("change", on);
  }, []);
  const setPreview = (open: boolean) => {
    setPreviewOpen(open);
    try {
      localStorage.setItem(PREVIEW_KEY, open ? "1" : "0");
    } catch {}
  };
  const showPanel = wide && previewOpen;

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

  const jumpTo = (i: number) => {
    const el = document.getElementById(`ws-sec-${i}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("ws-flash");
    void el.offsetWidth;
    el.classList.add("ws-flash");
  };

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;
  if (loadError) return <div className="page-narrow stack"><Link href="/admin/website" className="link small">← Website</Link><div className="alert alert-danger">{loadError}</div></div>;
  if (!data) return <div className="page text-muted">Loading…</div>;

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

  const onPreviewTab = () => {
    // Opened right away (so the browser doesn't block the new tab), then
    // pointed at the preview once the draft is saved.
    const tab = window.open("about:blank", "_blank");
    run("preview", async () => {
      if (!(await flush())) {
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
      if (!(await flush())) return setNotice({ ok: false, text: "Couldn't save your latest changes, so nothing was published. Fix the problems above and try again." });
      const res = await fetch(`/api/admin/website/${params.page}/publish`, { method: "POST" });
      if (!res.ok) return setNotice({ ok: false, text: "Couldn't publish. Please try again." });
      setData((old) => (old ? { ...old, hasDraft: false, live: structuredClone(latest.current), publishedAt: new Date().toISOString() } : old));
      setNotice({ ok: true, text: "Published. The live site shows your changes now." });
      preview.current?.reload();
    });
  };

  const onDiscard = () => {
    if (!confirm("Discard all unpublished changes to this page? It goes back to what's live now.")) return;
    run("discard", async () => {
      window.clearTimeout(timer.current);
      timer.current = undefined;
      await chain.current;
      const res = await fetch(`/api/admin/website/${params.page}/discard`, { method: "POST" });
      if (!res.ok) return setNotice({ ok: false, text: "Couldn't discard the draft." });
      rev.current++;
      load();
      setNotice({ ok: true, text: "Draft discarded." });
      preview.current?.reload();
    });
  };

  const unpublished = data.hasDraft || unsaved || !same(values, data.live);
  const statusText =
    saveState === "pending" ? "Saving…" : saveState === "error" ? null : unpublished ? "Draft saved · not live yet" : "Live page is up to date";

  return (
    <div className={`page stack-lg ws-ed${showPanel ? " ws-ed-wide" : ""}`} style={{ gap: 28 }}>
      <div className={showPanel ? "ws-ed-grid" : undefined}>
        <div className="stack-lg" style={{ gap: 28, minWidth: 0, maxWidth: showPanel ? undefined : 980 }}>
          <div className="row-wrap" style={{ gap: 16 }}>
            <Link href="/admin/website" className="link small">All website pages</Link>
          </div>
          <div className="stack-sm">
            <h1 className="page-title">{data.page.label}</h1>
            <p className="lede" style={{ fontSize: 17 }}>
              {params.page === "footer" ? "The bottom of every page." : <>The page at <a className="link" href={data.page.path} target="_blank" rel="noreferrer">{data.page.path}</a>.</>}{" "}
              Changes save as a draft automatically; visitors see them only after you publish. Text shows exactly as typed (no formatting codes); a line break starts a new paragraph.
            </p>
          </div>

          <div className="card stack ws-bar" style={{ gap: 12 }}>
            <div className="row-wrap" style={{ gap: 10, alignItems: "center" }}>
              <span role="status" aria-live="polite" className={`ws-status ws-status-${saveState === "error" ? "error" : saveState === "pending" ? "saving" : unpublished ? "draft" : "live"}`}>
                {statusText ?? (
                  <>
                    Couldn&apos;t save —{" "}
                    <button type="button" className="ws-linkbtn" onClick={() => saveNow()}>retry</button>
                  </>
                )}
              </span>
              <span style={{ flex: 1 }} />
              {(!wide || !previewOpen) && (
                <button type="button" className="btn btn-soft" disabled={!!busy} onClick={wide ? () => setPreview(true) : onPreviewTab}>
                  {busy === "preview" ? "Opening…" : wide ? "Show preview" : "Preview"}
                </button>
              )}
              <button type="button" className="btn btn-primary" disabled={!!busy || !unpublished || saveState === "error"} onClick={onPublish}>{busy === "publish" ? "Publishing…" : "Publish"}</button>
              <button type="button" className="btn" disabled={!!busy || !(data.hasDraft || unsaved)} onClick={onDiscard}>Discard draft</button>
            </div>
            {sections.length > 1 && (
              <nav className="ws-jump" aria-label="Jump to a section">
                <span className="ws-jump-label">Jump to</span>
                {sections.map((s, i) => (
                  <button key={i} type="button" onClick={() => jumpTo(i)}>{s.title || "Other"}</button>
                ))}
              </nav>
            )}
          </div>

          {saveErrors && (
            <div role="alert" className="alert alert-danger">
              {saveErrors.text}
              {saveErrors.errors && saveErrors.errors.length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                  {saveErrors.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
          {notice && <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>{notice.text}</div>}

          {sections.map((s, si) => (
            <section key={si} id={`ws-sec-${si}`} className="card stack ws-sec" style={{ gap: 18 }}>
              {s.title && <h2 style={{ fontSize: 22 }}>{s.title}</h2>}
              {s.names.map((name) => {
                const f = data.page.fields[name];
                const differsFromDefault = !same(values[name], data.defaults[name]);
                const changed = !same(values[name], data.live[name]);
                return (
                  <div key={name} className="stack-sm" style={{ gap: 6 }}>
                    {f.type === "list" ? (
                      <div className={changed ? "ws-changed" : undefined}>
                        {changed && <div style={{ marginBottom: 8 }}><ChangedTag /></div>}
                        <ListEditor def={f as ListDef} value={values[name] || []} live={data.live[name] || []} onChange={(v) => change(name, v)} />
                      </div>
                    ) : (
                      <ScalarEditor def={f as ScalarDef} value={values[name]} changed={changed} onChange={(v) => change(name, v)} />
                    )}
                    {differsFromDefault && (
                      <button
                        type="button"
                        className="link small"
                        style={{ alignSelf: "flex-start", background: "none", border: 0, padding: 0, cursor: "pointer" }}
                        onClick={() => {
                          if (confirm(`Put “${f.label}” back to the built-in default?`)) change(name, structuredClone(data.defaults[name]));
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

        {showPanel && <EditorPreview ref={preview} pageKey={params.page} path={data.page.path} onHide={() => setPreview(false)} />}
      </div>
    </div>
  );
}
