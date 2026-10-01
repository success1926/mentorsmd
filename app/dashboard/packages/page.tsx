"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon, ICONS } from "@/components/ui";
import {
  CALL_LENGTHS,
  FORMATS,
  MAX_CALLS,
  SERVICES,
  TURNAROUNDS,
  formatHasCall,
  labelFor,
  money,
} from "@/lib/options";

type Form = {
  title: string;
  description: string;
  price: string;
  service: string;
  format: string;
  turnaround: string;
  callsIncluded: number;
  callLength: number;
  calEventUrl: string;
};

const EMPTY: Form = { title: "", description: "", price: "", service: "", format: "", turnaround: "", callsIncluded: 1, callLength: 45, calEventUrl: "" };

function missing(g: any) {
  const m: string[] = [];
  if (!g.service) m.push("service");
  if (!g.format) m.push("format");
  if (!g.turnaround) m.push("turnaround");
  if (formatHasCall(g.format) && (!g.callsIncluded || !g.callLength)) m.push("call details");
  return m;
}

function Seg({ options, value, onChange, label }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.value} className="seg-opt" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PackageForm({ initial, onSaved, onCancel, gigId }: { initial: Form; onSaved: () => void; onCancel: () => void; gigId?: string }) {
  const [f, setF] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<Form>) => setF((prev) => ({ ...prev, ...patch }));
  const hasCall = formatHasCall(f.format);
  const complete = f.title.trim() && f.description.trim() && f.price && f.service && f.format && f.turnaround;

  async function save() {
    setSaving(true);
    setError("");
    const body = {
      title: f.title,
      description: f.description,
      price: f.price,
      service: f.service,
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
      <b style={{ fontSize: 19 }}>{gigId ? "Edit package" : "New package"}</b>

      <label className="field">
        <span className="field-label">Title</span>
        <input className="input" maxLength={120} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Personal statement review + 45-min call" />
      </label>
      <label className="field">
        <span className="field-label">Description</span>
        <textarea className="input" maxLength={5000} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="What's included, what you need from the student, and what they get back." />
      </label>
      <label className="field" style={{ maxWidth: 220 }}>
        <span className="field-label">Price (USD)</span>
        <input className="input" type="number" min={5} max={10000} step="1" value={f.price} onChange={(e) => set({ price: e.target.value })} placeholder="150" />
      </label>

      <div className="card card-tint stack" style={{ padding: 20 }}>
        <div className="stack-sm" style={{ gap: 2 }}>
          <b>Search questions</b>
          <span className="text-muted">Required. Students filter by these, and packages missing an answer are hidden from search.</span>
        </div>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Service</span>
          <select className="input" value={f.service} onChange={(e) => set({ service: e.target.value })}>
            <option value="">Choose a service…</option>
            {SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Format</span>
          <Seg label="Format" options={FORMATS} value={f.format} onChange={(v) => set({ format: v })} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Turnaround</span>
          <Seg label="Turnaround" options={TURNAROUNDS} value={f.turnaround} onChange={(v) => set({ turnaround: v })} />
        </div>
        {hasCall && (
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Calls included</span>
              <Seg
                label="Calls included"
                options={Array.from({ length: MAX_CALLS }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                value={String(f.callsIncluded)}
                onChange={(v) => set({ callsIncluded: Number(v) })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Call length</span>
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
      <div className="row">
        <button className="btn btn-primary" disabled={!complete || saving} onClick={save}>
          {saving ? "Saving…" : gigId ? "Save changes" : "Publish package"}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function PackagesPage() {
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

  async function remove(g: any) {
    if (!confirm(`Remove "${g.title}"? It disappears from your profile and search. Existing orders aren't affected.`)) return;
    const res = await fetch(`/api/gigs/${g.id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json().catch(() => ({}))).error || "Couldn't remove the package");
    load();
  }

  if (session && !isSeller) return <div className="page-narrow"><div className="alert">Packages are for mentor accounts.</div></div>;

  const mentorMissing = profile && (!profile.mentorStage || !profile.schoolType);

  return (
    <div className="page-mid stack-lg">
      <div className="between" style={{ flexWrap: "wrap" }}>
        <div className="stack-sm">
          <h1 className="page-title">My packages</h1>
          <p className="lede">What students can book from you.</p>
        </div>
        {editing !== "new" && (
          <button className="btn btn-primary" onClick={() => setEditing("new")}>+ New package</button>
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

      {editing === "new" && (
        <PackageForm initial={EMPTY} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}

      {gigs === null && <p className="text-muted">Loading…</p>}
      {gigs?.length === 0 && editing !== "new" && (
        <div className="empty stack" style={{ alignItems: "center" }}>
          <b style={{ color: "var(--ink)" }}>No packages yet</b>
          <span>Create your first package so students can book you.</span>
          <button className="btn btn-primary" onClick={() => setEditing("new")}>Create a package</button>
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
                    {g.service && <span className="badge badge-brand">{labelFor(SERVICES, g.service)}</span>}
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
              {missing(g).length > 0 ? (
                <div className="alert alert-warning small">Hidden from search until you answer: {missing(g).join(", ")}.</div>
              ) : mentorMissing ? (
                <span className="badge badge-warning" style={{ alignSelf: "flex-start" }}>Hidden until your mentor questions are answered</span>
              ) : (
                <span className="badge badge-success" style={{ alignSelf: "flex-start" }}>Live in search</span>
              )}
              <div className="row">
                <button className="btn btn-sm" onClick={() => setEditing(g.id)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(g)}>Remove</button>
                <Link href={`/coaches/${g.sellerId}#pkg-${g.id}`} className="link small" style={{ marginLeft: "auto" }}>View on profile</Link>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
