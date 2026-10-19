"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MentorAgreement } from "@/components/MentorAgreement";
import { ImageFocusEditor } from "@/components/ImageFocusEditor";
import { Icon, ICONS } from "@/components/ui";
import { focusPosition, stripFocus } from "@/lib/imageFocus";
import {
  BUNDLE_HOURS,
  FORMATS,
  GIG_DESCRIPTION_MIN_WORDS,
  MAX_BUNDLES,
  MAX_SPECIALIZED,
  PACKAGE_MAX_MINUTES,
  PACKAGE_MIN_MINUTES,
  RATE_MIN_CENTS,
  RATE_RULE,
  SERVICES,
  SERVICE_OTHER_MAX,
  countWords,
  labelFor,
  money,
  serviceLabel,
} from "@/lib/options";
import { hoursLabel, offerRate, parseRateDollars, priceFor, priceMath } from "@/lib/pricing";

// Rate & offers (docs/redesign-2026-10.md section 3): the mentor's hourly
// rate, the Hourly offer (on/off, what it's for), hour bundles and
// specialized packages. Prices are never typed in: they're hours x rate.
// Changing a rate never changes what an existing order paid.

type Offers = { hourlyRateCents: number | null; hourly: any | null; bundles: any[]; packages: any[] };

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return <div role="status" className={`alert ${m.ok ? "alert-success" : "alert-danger"}`}>{m.text}</div>;
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

// "" -> null (use the hourly rate); otherwise the cents, or "bad".
function ownRate(text: string): number | null | "bad" {
  if (!text.trim()) return null;
  return parseRateDollars(text) ?? "bad";
}

async function send(url: string, method: string, body?: any) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function RateAndOffersPage() {
  const { data: session } = useSession();
  const isSeller = (session?.user as any)?.role === "SELLER";
  const [offers, setOffers] = useState<Offers | null>(null);
  const [payoutsReady, setPayoutsReady] = useState<boolean | null>(null);

  function load() {
    fetch("/api/offers")
      .then((r) => r.json())
      .then((d) => setOffers({ hourlyRateCents: d.hourlyRateCents ?? null, hourly: d.hourly ?? null, bundles: d.bundles || [], packages: d.packages || [] }))
      .catch(() => setOffers({ hourlyRateCents: null, hourly: null, bundles: [], packages: [] }));
  }

  useEffect(() => {
    if (!isSeller) return;
    load();
    fetch("/api/stripe/status").then((r) => r.json()).then((d) => setPayoutsReady(!!d.connected)).catch(() => {});
  }, [isSeller]);

  if (session && !isSeller) return <div className="page-narrow"><div className="alert">Rates and offers are for mentor accounts.</div></div>;
  if (!offers) return <div className="page-mid text-muted">Loading…</div>;

  const rate = offers.hourlyRateCents;

  return (
    <div className="page-mid stack-lg">
      <div className="stack-sm">
        <h1 className="page-title">Rate &amp; offers</h1>
        <p className="lede">Set one hourly rate. Every price on your profile is hours × rate, so students always see the math. There are no due dates: students use their hours for calls on your calendar and for written work.</p>
      </div>

      {payoutsReady === false && (
        <div className="alert alert-warning row" style={{ alignItems: "flex-start" }}>
          <Icon d={ICONS.alert} />
          <span className="grow">
            <b>Connect payouts before students can buy from you.</b> Checkout is blocked until your bank account is connected.
          </span>
          <Link href="/dashboard/payouts" className="btn btn-sm">Connect payouts</Link>
        </div>
      )}

      <RateCard rate={rate} onSaved={load} />
      {rate ? (
        <>
          <HourlyCard key={offers.hourly?.id || "hourly"} rate={rate} hourly={offers.hourly} onSaved={load} />
          <BundlesCard rate={rate} bundles={offers.bundles} onSaved={load} />
          <PackagesCard rate={rate} packages={offers.packages} onSaved={load} />
        </>
      ) : (
        <div className="empty">Set your hourly rate first. Then you can add hour bundles and specialized packages.</div>
      )}
    </div>
  );
}

// ---------------- Hourly rate ----------------

function RateCard({ rate, onSaved }: { rate: number | null; onSaved: () => void }) {
  const [text, setText] = useState(rate ? String(rate / 100) : "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const cents = parseRateDollars(text);
  const bad = !!text.trim() && cents === null;

  async function save() {
    if (cents === null) return setMsg({ ok: false, text: RATE_RULE });
    setSaving(true);
    setMsg(null);
    const { ok, data } = await send("/api/offers", "PATCH", { rate: cents / 100 });
    setSaving(false);
    setMsg(ok ? { ok: true, text: "Saved. Prices that use your hourly rate are updated; existing orders keep what they paid." } : { ok: false, text: data.error || "Couldn't save" });
    if (ok) onSaved();
  }

  return (
    <section id="rate" className="card stack" style={{ scrollMarginTop: 100 }}>
      <div className="stack-sm">
        <h2 style={{ fontSize: 26 }}>Your hourly rate</h2>
        <span className="text-secondary">One rate for your time, in whole dollars, at least {money(RATE_MIN_CENTS)} an hour. You earn 70% of every hour; MentorsMD keeps 30%.</span>
      </div>
      <div className="row-wrap" style={{ alignItems: "flex-end" }}>
        <label className="field" style={{ marginBottom: 0, width: 200 }}>
          <span className="field-label">Rate per hour (USD)</span>
          <input className={`input ${bad ? "input-error" : ""}`} type="number" inputMode="numeric" min={RATE_MIN_CENTS / 100} step={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="80" aria-invalid={bad} />
        </label>
        <button className="btn btn-primary" disabled={saving || cents === null || cents === rate} onClick={save}>{saving ? "Saving…" : "Save rate"}</button>
      </div>
      <span className="field-help" style={{ color: bad ? "var(--danger)" : undefined }}>
        {bad ? RATE_RULE : cents ? `Students pay ${money(cents)} for 1 hour and ${money(priceFor(180, cents))} for 3 hours. You earn ${money(Math.round(cents * 0.7))} an hour.` : "Changing your rate later never changes what an existing order paid."}
      </span>
      <Msg m={msg} />
    </section>
  );
}

// ---------------- Hourly offer ----------------

function HourlyCard({ rate, hourly, onSaved }: { rate: number; hourly: any | null; onSaved: () => void }) {
  const on = hourly ? !!hourly.active : true;
  const [format, setFormat] = useState<string>(hourly?.format || "WRITTEN_CALL");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(patch: { active?: boolean; format?: string }) {
    setBusy(true);
    setMsg(null);
    const { ok, data } = await send("/api/offers", "PATCH", { hourly: patch });
    setBusy(false);
    setMsg(ok ? { ok: true, text: "Saved." } : { ok: false, text: data.error || "Couldn't save" });
    if (ok) onSaved();
  }

  return (
    <section className="card stack">
      <div className="between" style={{ alignItems: "flex-start", gap: 16 }}>
        <div className="stack-sm">
          <h2 style={{ fontSize: 26 }}>Hourly</h2>
          <span className="text-secondary">1 hour at your hourly rate ({money(rate)}). Students can buy one hour at a time and add more later.</span>
        </div>
        <label className="switch" title={on ? "On" : "Off"}>
          <input type="checkbox" checked={on} disabled={busy} aria-label="Offer single hours" onChange={() => save({ active: !on })} />
          <span />
        </label>
      </div>
      {on && (
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Students can use it for</span>
          <Seg label="Hourly format" options={FORMATS} value={format} onChange={(v) => { setFormat(v); save({ format: v }); }} />
        </div>
      )}
      {!on && <span className="text-muted">Off: students can still book a free intro call, buy your bundles and packages, and pay per call.</span>}
      <Msg m={msg} />
    </section>
  );
}

// ---------------- Hour bundles ----------------

function BundlesCard({ rate, bundles, onSaved }: { rate: number; bundles: any[]; onSaved: () => void }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);

  async function remove(b: any) {
    if (!confirm(`Remove the ${hoursLabel(b.minutes)} bundle? Existing orders aren't affected.`)) return;
    const { ok, data } = await send(`/api/gigs/${b.id}`, "DELETE");
    if (!ok) alert(data.error || "Couldn't remove it");
    onSaved();
  }

  return (
    <section className="card stack">
      <div className="between" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="stack-sm">
          <h2 style={{ fontSize: 26 }}>Hour bundles</h2>
          <span className="text-secondary">A block of hours bought up front, e.g. 3, 5 or 10. Each bundle can have its own per-hour rate (for example a small discount for 10 hours). Price = hours × rate.</span>
        </div>
        {editing !== "new" && bundles.length < MAX_BUNDLES && <button className="btn btn-soft btn-sm" onClick={() => setEditing("new")}>+ Add a bundle</button>}
      </div>
      {bundles.length === 0 && editing !== "new" && <span className="text-muted">No bundles yet.</span>}
      {editing === "new" && <BundleForm rate={rate} taken={bundles.map((b) => b.minutes / 60)} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved(); }} />}
      {bundles.map((b) =>
        editing === b.id ? (
          <BundleForm key={b.id} rate={rate} bundle={b} taken={bundles.filter((x) => x.id !== b.id).map((x) => x.minutes / 60)} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved(); }} />
        ) : (
          <div key={b.id} className="pkg-line">
            <span className="stack-sm" style={{ gap: 2 }}>
              <b>{hoursLabel(b.minutes)}</b>
              <span className="text-muted">{priceMath(b.minutes, offerRate(b, rate)!)}{b.rateCents ? " (own rate)" : ""}</span>
            </span>
            <span className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm" onClick={() => setEditing(b.id)}>Edit</button>
              <button className="btn btn-sm btn-danger" onClick={() => remove(b)}>Remove</button>
            </span>
          </div>
        )
      )}
    </section>
  );
}

function BundleForm({ rate, bundle, taken, onCancel, onSaved }: { rate: number; bundle?: any; taken: number[]; onCancel: () => void; onSaved: () => void }) {
  const [hours, setHours] = useState<number>(bundle ? bundle.minutes / 60 : BUNDLE_HOURS.find((h) => !taken.includes(h)) || 3);
  const [rateText, setRateText] = useState(bundle?.rateCents ? String(bundle.rateCents / 100) : "");
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const own = ownRate(rateText);
  const effective = own === "bad" || own === null ? rate : own;

  async function save() {
    if (own === "bad") return setError(RATE_RULE);
    if (taken.includes(hours)) return setError("You already have a bundle with that many hours.");
    if (!agreed) return setError("Please tick the box to accept the mentor agreement.");
    setSaving(true);
    setError("");
    const body = { kind: "BUNDLE", hours, rate: rateText.trim(), agreement: agreed };
    const { ok, data } = await send(bundle ? `/api/gigs/${bundle.id}` : "/api/gigs", bundle ? "PATCH" : "POST", body);
    setSaving(false);
    if (!ok) return setError(data.error || "Couldn't save the bundle");
    onSaved();
  }

  return (
    <div className="card stack" style={{ borderColor: "var(--tint-2)", boxShadow: "var(--shadow-sm)" }}>
      <b style={{ fontSize: 18 }}>{bundle ? "Edit bundle" : "New hour bundle"}</b>
      <div className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">Hours</span>
        <Seg label="Hours in the bundle" options={BUNDLE_HOURS.map((h) => ({ value: String(h), label: `${h} hours` }))} value={String(hours)} onChange={(v) => setHours(Number(v))} />
      </div>
      <label className="field" style={{ marginBottom: 0, maxWidth: 280 }}>
        <span className="field-label">Own per-hour rate (optional)</span>
        <input className={`input ${own === "bad" ? "input-error" : ""}`} type="number" min={RATE_MIN_CENTS / 100} step={1} value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder={`${rate / 100} (your hourly rate)`} />
        <span className="field-help" style={{ color: own === "bad" ? "var(--danger)" : undefined }}>{own === "bad" ? RATE_RULE : "Leave empty to use your hourly rate."}</span>
      </label>
      <div className="alert alert-blue"><b>Price:</b> {priceMath(hours * 60, effective)}</div>
      <MentorAgreement checked={agreed} onChange={(v) => { setAgreed(v); if (v) setError(""); }} compact />
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <div className="row">
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : bundle ? "Save bundle" : "Add bundle"}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ---------------- Specialized packages ----------------

type PkgForm = { title: string; description: string; hours: string; format: string; service: string; serviceOther: string; rate: string; coverUrl: string };
const EMPTY_PKG: PkgForm = { title: "", description: "", hours: "3", format: "", service: "", serviceOther: "", rate: "", coverUrl: "" };

function PackagesCard({ rate, packages, onSaved }: { rate: number; packages: any[]; onSaved: () => void }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);

  async function remove(g: any) {
    if (!confirm(`Remove "${g.title}"? It disappears from your profile. Existing orders aren't affected.`)) return;
    const { ok, data } = await send(`/api/gigs/${g.id}`, "DELETE");
    if (!ok) alert(data.error || "Couldn't remove the package");
    onSaved();
  }

  return (
    <section className="card stack">
      <div className="between" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="stack-sm">
          <h2 style={{ fontSize: 26 }}>Specialized packages</h2>
          <span className="text-secondary">A titled package with what&apos;s included and your estimate of the hours it takes. If it takes longer, the student adds hours. Price = estimated hours × rate.</span>
        </div>
        {editing !== "new" && packages.length < MAX_SPECIALIZED && <button className="btn btn-soft btn-sm" onClick={() => setEditing("new")}>+ Add a package</button>}
      </div>
      {packages.length === 0 && editing !== "new" && <span className="text-muted">No specialized packages yet.</span>}
      {editing === "new" && <PackageForm rate={rate} initial={EMPTY_PKG} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved(); }} />}
      {packages.map((g) =>
        editing === g.id ? (
          <PackageForm
            key={g.id}
            rate={rate}
            gigId={g.id}
            initial={{
              title: g.title,
              description: g.description,
              hours: String((g.minutes || 60) / 60),
              format: g.format || "",
              service: g.service || "",
              serviceOther: g.serviceOther || "",
              rate: g.rateCents ? String(g.rateCents / 100) : "",
              coverUrl: g.coverUrl || "",
            }}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); onSaved(); }}
          />
        ) : (
          <div key={g.id} className="pkg-card" style={{ padding: 0, overflow: "hidden" }}>
            {g.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stripFocus(g.coverUrl)} alt="" style={{ width: "100%", height: 120, objectFit: "cover", objectPosition: focusPosition(g.coverUrl) }} />
            )}
            <div className="stack-sm" style={{ padding: "16px 20px 20px" }}>
              <div className="between" style={{ alignItems: "flex-start" }}>
                <b style={{ fontSize: 18 }}>{g.title}</b>
                <span className="display nowrap" style={{ fontSize: 24 }}>{money(g.price)}</span>
              </div>
              <div className="pkg-meta">
                <span className="badge badge-blue">{labelFor(FORMATS, g.format)}</span>
                <span className="badge">About {hoursLabel(g.minutes)}</span>
                {g.service && <span className="badge badge-brand">{serviceLabel(g.service, g.serviceOther)}</span>}
              </div>
              <span className="text-muted small">{priceMath(g.minutes, offerRate(g, rate)!)}{g.rateCents ? " (own rate)" : ""}</span>
              <p className="text-secondary" style={{ whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{g.description}</p>
              <div className="row">
                <button className="btn btn-sm" onClick={() => setEditing(g.id)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(g)}>Remove</button>
                <Link href={`/mentors/${g.sellerId}?package=${g.id}`} className="link small" style={{ marginLeft: "auto" }}>View on profile</Link>
              </div>
            </div>
          </div>
        )
      )}
    </section>
  );
}

function PackageForm({ rate, initial, gigId, onCancel, onSaved }: { rate: number; initial: PkgForm; gigId?: string; onCancel: () => void; onSaved: () => void }) {
  const [f, setF] = useState<PkgForm>(initial);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<PkgForm>) => setF((prev) => ({ ...prev, ...patch }));
  const words = countWords(f.description);
  const minutes = Math.round(Number(f.hours) * 60);
  const hoursOk = Number.isFinite(minutes) && minutes % 30 === 0 && minutes >= PACKAGE_MIN_MINUTES && minutes <= PACKAGE_MAX_MINUTES;
  const own = ownRate(f.rate);
  const effective = own === "bad" || own === null ? rate : own;

  const todo = [
    !f.title.trim() && "Title",
    words < GIG_DESCRIPTION_MIN_WORDS && "What's included",
    !hoursOk && "Estimated hours",
    !f.format && "Format",
    own === "bad" && "Rate",
    f.service === "OTHER" && f.serviceOther.trim().length < 3 && "Topic name",
  ].filter(Boolean) as string[];

  async function save() {
    if (todo.length) return setError(`Fill in: ${todo.join(", ")}.`);
    if (!agreed) return setError("Please tick the box to accept the mentor agreement.");
    setSaving(true);
    setError("");
    const body = {
      kind: "SPECIALIZED",
      title: f.title,
      description: f.description,
      hours: minutes / 60,
      format: f.format,
      service: f.service || null,
      serviceOther: f.service === "OTHER" ? f.serviceOther.trim() : null,
      rate: f.rate.trim(),
      coverUrl: f.coverUrl || null,
      agreement: agreed,
    };
    const { ok, data } = await send(gigId ? `/api/gigs/${gigId}` : "/api/gigs", gigId ? "PATCH" : "POST", body);
    setSaving(false);
    if (!ok) return setError(data.error || "Couldn't save the package");
    onSaved();
  }

  return (
    <div className="card stack" style={{ borderColor: "var(--tint-2)", boxShadow: "var(--shadow-sm)" }}>
      <b style={{ fontSize: 18 }}>{gigId ? "Edit package" : "New specialized package"}</b>
      <label className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">Title<span className="req" aria-hidden="true"> *</span></span>
        <input className="input" maxLength={120} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Personal statement, start to finish" />
      </label>
      <label className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">What&apos;s included<span className="req" aria-hidden="true"> *</span></span>
        <textarea className="input" style={{ minHeight: 130 }} maxLength={5000} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="What you'll do together, what you need from the student, and what they get back. Hours are used at the student's pace, so there's no due date." />
        <span className="field-help" style={{ color: words > 0 && words < GIG_DESCRIPTION_MIN_WORDS ? "var(--danger)" : undefined }}>{words} / {GIG_DESCRIPTION_MIN_WORDS} words minimum</span>
      </label>
      <div className="grid-2">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Estimated hours<span className="req" aria-hidden="true"> *</span></span>
          <input className={`input ${f.hours && !hoursOk ? "input-error" : ""}`} type="number" min={PACKAGE_MIN_MINUTES / 60} max={PACKAGE_MAX_MINUTES / 60} step={0.5} value={f.hours} onChange={(e) => set({ hours: e.target.value })} />
          <span className="field-help">{PACKAGE_MIN_MINUTES / 60} to {PACKAGE_MAX_MINUTES / 60} hours, in half-hour steps.</span>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Own per-hour rate (optional)</span>
          <input className={`input ${own === "bad" ? "input-error" : ""}`} type="number" min={RATE_MIN_CENTS / 100} step={1} value={f.rate} onChange={(e) => set({ rate: e.target.value })} placeholder={`${rate / 100} (your hourly rate)`} />
          <span className="field-help" style={{ color: own === "bad" ? "var(--danger)" : undefined }}>{own === "bad" ? RATE_RULE : "Leave empty to use your hourly rate."}</span>
        </label>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">Format<span className="req" aria-hidden="true"> *</span></span>
        <Seg label="Format" options={FORMATS} value={f.format} onChange={(v) => set({ format: v })} />
      </div>
      <div className="grid-2">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Topic (optional, helps students find it)</span>
          <select className="input" value={f.service} onChange={(e) => set({ service: e.target.value })}>
            <option value="">No topic</option>
            {SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        {f.service === "OTHER" && (
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Name the topic</span>
            <input className="input" maxLength={SERVICE_OTHER_MAX} value={f.serviceOther} onChange={(e) => set({ serviceOther: e.target.value })} placeholder="e.g. CASPer prep" />
          </label>
        )}
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">Cover photo (optional)</span>
        <span className="field-help">Shown behind the title on your profile, with a dark fade so the title stays readable.</span>
        <ImageFocusEditor value={f.coverUrl} onChange={(v) => set({ coverUrl: v })} uploadEndpoint="/api/gigs/cover-upload" crops={[{ w: 220, h: 120 }, { w: 120, h: 120 }]} />
      </div>
      {hoursOk && own !== "bad" && <div className="alert alert-blue"><b>Price:</b> {priceMath(minutes, effective)}</div>}
      <MentorAgreement checked={agreed} onChange={(v) => { setAgreed(v); if (v) setError(""); }} compact />
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <div className="row">
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : gigId ? "Save package" : "Publish package"}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
