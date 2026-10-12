"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon, ICONS } from "@/components/ui";
import {
  CALL_LENGTHS,
  FORMATS,
  GIG_DESCRIPTION_MIN_WORDS,
  MAX_CALLS,
  PRICE_MAX_CENTS,
  PRICE_MIN_CENTS,
  PRICE_RULE,
  SERVICES,
  SERVICE_OTHER_MAX,
  SERVICE_OTHER_MIN,
  TURNAROUNDS,
  countWords,
  formatHasCall,
  isPriceInRange,
  labelFor,
  money,
  serviceLabel,
} from "@/lib/options";

type Form = {
  title: string;
  description: string;
  price: string;
  service: string;
  serviceOther: string;
  format: string;
  turnaround: string;
  callsIncluded: number;
  callLength: number;
  calEventUrl: string;
};

const EMPTY: Form = { title: "", description: "", price: "", service: "", serviceOther: "", format: "", turnaround: "", callsIncluded: 1, callLength: 45, calEventUrl: "" };

function missing(g: any) {
  const m: string[] = [];
  if (!g.service) m.push("service");
  if (g.service === "OTHER" && !g.serviceOther) m.push("service name");
  if (!g.format) m.push("format");
  if (!g.turnaround) m.push("turnaround");
  if (formatHasCall(g.format) && (!g.callsIncluded || !g.callLength)) m.push("call details");
  return m;
}

function priceError(price: string) {
  if (!price.trim()) return "";
  const n = Number(price);
  if (!Number.isFinite(n) || !isPriceInRange(Math.round(n * 100))) return PRICE_RULE;
  return "";
}

function Seg({ options, value, onChange, label, id }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; label: string; id?: string }) {
  return (
    <div className="seg" role="group" aria-label={label} id={id} tabIndex={-1}>
      {options.map((o) => (
        <button type="button" key={o.value} className="seg-opt" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Req() {
  return <span className="req" aria-hidden="true"> *</span>;
}

// Every field is required. Publish stays clickable so a mentor who clicks
// it early is told exactly what's missing instead of facing a dead button.
function PackageForm({ initial, onSaved, onCancel, gigId }: { initial: Form; onSaved: () => void; onCancel: () => void; gigId?: string }) {
  const [f, setF] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const set = (patch: Partial<Form>) => setF((prev) => ({ ...prev, ...patch }));
  const hasCall = formatHasCall(f.format);
  const words = countWords(f.description);
  const pErr = priceError(f.price);
  const otherLen = f.serviceOther.trim().length;

  // [field id, label, is it filled in correctly]
  const checks: [string, string, boolean][] = [
    ["pf-title", "Title", !!f.title.trim()],
    ["pf-description", "Description", words >= GIG_DESCRIPTION_MIN_WORDS],
    ["pf-price", "Price", !!f.price.trim() && !pErr],
    ["pf-service", "Service", !!f.service],
    ...(f.service === "OTHER" ? ([["pf-service-other", "Service name", otherLen >= SERVICE_OTHER_MIN && otherLen <= SERVICE_OTHER_MAX]] as [string, string, boolean][]) : []),
    ["pf-format", "Format", !!f.format],
    ["pf-turnaround", "Turnaround", !!f.turnaround],
  ];
  const todo = checks.filter(([, , ok]) => !ok);
  const bad = (id: string) => showErrors && todo.some(([t]) => t === id);

  function jumpTo(id: string) {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLElement | null)?.focus({ preventScroll: true });
  }

  async function save() {
    if (todo.length) {
      setShowErrors(true);
      jumpTo(todo[0][0]);
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      title: f.title,
      description: f.description,
      price: f.price,
      service: f.service,
      serviceOther: f.service === "OTHER" ? f.serviceOther.trim() : null,
      format: f.format,
      turnaround: f.turnaround,
      callsIncluded: hasCall ? f.callsIncluded : 0,
      callLength: hasCall ? f.callLength : null,
      calEventUrl: hasCall ? f.calEventUrl.trim() : "",
    };
    const res = await fetch(gigId ? `/api/gigs/${gigId}` : "/api/gigs", {
      method: gigId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "Couldn't save the package");
    onSaved();
  }

  return (
    <div className="card stack" style={{ borderColor: "var(--tint-2)", boxShadow: "var(--shadow-sm)" }}>
      <div className="stack-sm" style={{ gap: 2 }}>
        <b style={{ fontSize: 19 }}>{gigId ? "Edit package" : "New package"}</b>
        <span className="text-muted">Every field marked <span className="req">*</span> is required.</span>
      </div>

      <label className="field">
        <span className="field-label">Title<Req /></span>
        <input id="pf-title" className={`input ${bad("pf-title") ? "input-error" : ""}`} maxLength={120} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Personal statement review + 45-min call" />
      </label>
      <label className="field">
        <span className="field-label">Description<Req /></span>
        <textarea id="pf-description" className={`input ${bad("pf-description") ? "input-error" : ""}`} maxLength={5000} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="What's included, what you need from the student, and what they get back." />
        <span className="field-help" style={{ color: words > 0 && words < GIG_DESCRIPTION_MIN_WORDS ? "var(--danger)" : undefined }}>
          {words} / {GIG_DESCRIPTION_MIN_WORDS} words minimum
        </span>
      </label>
      <label className="field" style={{ maxWidth: 260 }}>
        <span className="field-label">Price (USD)<Req /></span>
        <input id="pf-price" className={`input ${pErr || bad("pf-price") ? "input-error" : ""}`} type="number" min={PRICE_MIN_CENTS / 100} max={PRICE_MAX_CENTS / 100} step="1" value={f.price} onChange={(e) => set({ price: e.target.value })} placeholder="150" aria-invalid={!!pErr} />
        <span className="field-help" style={{ color: pErr ? "var(--danger)" : undefined }}>{pErr || "Between $50 and $5,000."}</span>
      </label>

      <div className="card card-tint stack" style={{ padding: 20 }}>
        <div className="stack-sm" style={{ gap: 2 }}>
          <b>Search questions</b>
          <span className="text-muted">Students filter by these.</span>
        </div>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Service<Req /></span>
          <select id="pf-service" className={`input ${bad("pf-service") ? "input-error" : ""}`} value={f.service} onChange={(e) => set({ service: e.target.value })}>
            <option value="">Choose a service…</option>
            {SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        {f.service === "OTHER" && (
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">What&apos;s the service?<Req /></span>
            <input id="pf-service-other" className={`input ${bad("pf-service-other") ? "input-error" : ""}`} maxLength={SERVICE_OTHER_MAX} value={f.serviceOther} onChange={(e) => set({ serviceOther: e.target.value })} placeholder="e.g. CASPer prep" />
            <span className="field-help">Shown as this package&apos;s tag. {otherLen} / {SERVICE_OTHER_MAX} characters.</span>
          </label>
        )}
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Format<Req /></span>
          <div className={bad("pf-format") ? "seg-error" : ""}>
            <Seg id="pf-format" label="Format" options={FORMATS} value={f.format} onChange={(v) => set({ format: v })} />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Turnaround<Req /></span>
          <div className={bad("pf-turnaround") ? "seg-error" : ""}>
            <Seg id="pf-turnaround" label="Turnaround" options={TURNAROUNDS} value={f.turnaround} onChange={(v) => set({ turnaround: v })} />
          </div>
        </div>
        {hasCall && (
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Calls included<Req /></span>
              <Seg
                label="Calls included"
                options={Array.from({ length: MAX_CALLS }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                value={String(f.callsIncluded)}
                onChange={(v) => set({ callsIncluded: Number(v) })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Call length<Req /></span>
              <Seg
                label="Call length"
                options={CALL_LENGTHS.map((m) => ({ value: String(m), label: `${m} min` }))}
                value={String(f.callLength)}
                onChange={(v) => set({ callLength: Number(v) })}
              />
            </div>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Cal.com event link for this package (optional)</span>
              <span className="field-help">Leave blank to use the Cal.com link on your account. Use a specific event if this call has a different length.</span>
              <input className="input" value={f.calEventUrl} onChange={(e) => set({ calEventUrl: e.target.value })} placeholder="https://cal.com/your-name/45min" />
            </label>
          </>
        )}
      </div>

      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="btn btn-primary" aria-disabled={todo.length > 0 || saving} disabled={saving} onClick={save} style={todo.length ? { opacity: 0.55 } : undefined}>
          {saving ? "Saving…" : gigId ? "Save changes" : "Publish package"}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
      {todo.length > 0 && (
        <p className={showErrors ? "small" : "text-muted small"} role={showErrors ? "alert" : undefined} style={{ color: showErrors ? "var(--danger)" : undefined, margin: 0 }}>
          Fill in {todo.length} more field{todo.length > 1 ? "s" : ""} to {gigId ? "save" : "publish"}:{" "}
          {todo.map(([id, label], i) => (
            <span key={id}>
              <button type="button" className="link-btn" onClick={() => { setShowErrors(true); jumpTo(id); }}>{label}</button>
              {i < todo.length - 1 ? ", " : ""}
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}

export default function PackagesPage() {
  return (
    <Suspense fallback={<div className="page-mid text-muted">Loading…</div>}>
      <Packages />
    </Suspense>
  );
}

function Packages() {
  const { data: session } = useSession();
  const isSeller = (session?.user as any)?.role === "SELLER";
  const [gigs, setGigs] = useState<any[] | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [payoutsReady, setPayoutsReady] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);

  function load() {
    fetch("/api/gigs?mine=true")
      .then((r) => r.json())
      .then((d) => setGigs(d.gigs || []))
      .catch(() => setGigs([]));
  }

  useEffect(() => {
    if (!isSeller) return;
    load();
    fetch("/api/profile").then((r) => r.json()).then((d) => setProfile(d.profile)).catch(() => {});
    fetch("/api/stripe/status").then((r) => r.json()).then((d) => setPayoutsReady(!!d.connected)).catch(() => {});
  }, [isSeller]);

  // "+ Add package" (top bar, dashboard) links here with ?new=1, including
  // when the mentor is already on this page.
  const router = useRouter();
  const wantsNew = useSearchParams()?.get("new") === "1";
  useEffect(() => {
    if (wantsNew) setEditing("new");
  }, [wantsNew]);
  // Closing the new-package form clears ?new=1 so the link works again.
  function closeNew() {
    setEditing(null);
    if (wantsNew) router.replace("/dashboard/packages", { scroll: false });
  }

  async function remove(g: any) {
    if (!confirm(`Remove "${g.title}"? It disappears from your profile and search. Existing orders aren't affected.`)) return;
    const res = await fetch(`/api/gigs/${g.id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json().catch(() => ({}))).error || "Couldn't remove the package");
    load();
  }

  if (session && !isSeller) return <div className="page-narrow"><div className="alert">Packages are for mentor accounts.</div></div>;

  const mentorMissing = profile && (!profile.mentorStage || !profile.schoolType);
  const priceHidden = (gigs || []).filter((g) => !isPriceInRange(g.price));

  return (
    <div className="page-mid stack-lg">
      <div className="between" style={{ flexWrap: "wrap" }}>
        <div className="stack-sm">
          <h1 className="page-title">My packages</h1>
          <p className="lede">What students can book from you.</p>
        </div>
        {editing !== "new" && (
          <button className="btn btn-primary" onClick={() => setEditing("new")}>+ Add package</button>
        )}
      </div>

      {payoutsReady === false && (
        <div className="alert alert-warning row" style={{ alignItems: "flex-start" }}>
          <Icon d={ICONS.alert} />
          <span className="grow">
            <b>Connect payouts before students can book you.</b> Checkout is blocked until your bank account is connected.
          </span>
          <Link href="/dashboard/payouts" className="btn btn-sm">Connect payouts</Link>
        </div>
      )}
      {mentorMissing && (
        <div className="alert alert-warning row" style={{ alignItems: "flex-start" }}>
          <Icon d={ICONS.alert} />
          <span className="grow">
            <b>Your packages are hidden from search.</b> Answer the mentor questions (your stage and school type) on your account page.
          </span>
          <Link href="/account#search" className="btn btn-sm">Answer now</Link>
        </div>
      )}

      {priceHidden.length > 0 && (
        <div className="alert alert-warning row" style={{ alignItems: "flex-start" }}>
          <Icon d={ICONS.alert} />
          <span className="grow">
            <b>Update your price{priceHidden.length > 1 ? "s" : ""}.</b> Packages now need to be priced between $50 and $5,000.{" "}
            {priceHidden.length === 1 ? `"${priceHidden[0].title}" is` : `${priceHidden.length} packages are`} hidden from students until you edit the price.
          </span>
        </div>
      )}

      {editing === "new" && (
        <PackageForm initial={EMPTY} onCancel={closeNew} onSaved={() => { closeNew(); load(); }} />
      )}

      {gigs === null && <p className="text-muted">Loading…</p>}
      {gigs?.length === 0 && editing !== "new" && (
        <div className="empty stack" style={{ alignItems: "center" }}>
          <b style={{ color: "var(--ink)" }}>No packages yet</b>
          <span>Create your first package so students can book you.</span>
          <button className="btn btn-primary" onClick={() => setEditing("new")}>+ Add package</button>
        </div>
      )}

      <div className="stack">
        {gigs?.map((g) =>
          editing === g.id ? (
            <PackageForm
              key={g.id}
              gigId={g.id}
              initial={{
                title: g.title,
                description: g.description,
                price: String(g.price / 100),
                service: g.service || "",
                serviceOther: g.serviceOther || "",
                format: g.format || "",
                turnaround: g.turnaround || "",
                callsIncluded: g.callsIncluded || 1,
                callLength: g.callLength || 45,
                calEventUrl: g.calEventUrl || "",
              }}
              onCancel={() => setEditing(null)}
              onSaved={() => { setEditing(null); load(); }}
            />
          ) : (
            <div key={g.id} className="pkg-card">
              <div className="between" style={{ alignItems: "flex-start" }}>
                <div className="stack-sm grow">
                  <b style={{ fontSize: 18 }}>{g.title}</b>
                  <div className="pkg-meta">
                    {g.service && <span className="badge badge-brand">{serviceLabel(g.service, g.serviceOther)}</span>}
                    {g.format && <span className="badge badge-blue">{labelFor(FORMATS, g.format)}</span>}
                    {g.turnaround && <span className="badge">{labelFor(TURNAROUNDS, g.turnaround)}</span>}
                    {g.callsIncluded > 0 && <span className="badge badge-pink">{g.callsIncluded} × {g.callLength} min call</span>}
                  </div>
                </div>
                <span className="display" style={{ fontSize: 26 }}>{money(g.price)}</span>
              </div>
              <p className="text-secondary" style={{ whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {g.description}
              </p>
              {!isPriceInRange(g.price) ? (
                <div className="alert alert-warning small">Hidden from students: edit the price to between $50 and $5,000.</div>
              ) : missing(g).length > 0 ? (
                <div className="alert alert-warning small">Hidden from search until you answer: {missing(g).join(", ")}.</div>
              ) : mentorMissing ? (
                <span className="badge badge-warning" style={{ alignSelf: "flex-start" }}>Hidden until your mentor questions are answered</span>
              ) : (
                <span className="badge badge-success" style={{ alignSelf: "flex-start" }}>Live in search</span>
              )}
              <div className="row">
                <button className="btn btn-sm" onClick={() => setEditing(g.id)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(g)}>Remove</button>
                <Link href={`/mentors/${g.sellerId}#pkg-${g.id}`} className="link small" style={{ marginLeft: "auto" }}>View on profile</Link>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
