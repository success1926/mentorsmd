"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Icon, ICONS, Vetted, tintFor, initialsOf } from "@/components/ui";
import { FORMATS, TURNAROUNDS, labelFor, money, serviceLabel } from "@/lib/options";
import { DatePicker } from "@/components/DatePicker";
import { RECORDING_NOTICE } from "@/lib/calls";
import { fmtDayLabel } from "@/lib/tz";

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const gigId = params.id as string;

  const [gig, setGig] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [rules, setRules] = useState<{ earliest: string; latest: string; busy: { startDay: string; endDay: string }[]; explanation: string } | null>(null);

  useEffect(() => {
    // Read from window.location rather than useSearchParams, which would
    // need a Suspense boundary for this page to build.
    setCancelled(new URLSearchParams(window.location.search).get("cancelled") === "true");
    fetch(`/api/gigs/${gigId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) setNotFound(true);
        else setGig(data.gig);
      })
      .catch(() => setNotFound(true));
    // Earliest due date (from the turnaround) and the mentor's busy dates.
    fetch(`/api/gigs/${gigId}/due-dates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setRules(d);
        setDueDate((cur) => cur || d.earliest);
      })
      .catch(() => {});
  }, [gigId]);

  async function handleConfirm() {
    if (!dueDate) {
      setError("Pick a due date first.");
      return;
    }
    setPaying(true);
    setError("");
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gigId, dueDate }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setPaying(false);
      return;
    }
    window.location.href = data.url; // Stripe Checkout
  }

  if (notFound) {
    return (
      <div className="page-narrow">
        <div className="empty stack" style={{ alignItems: "center" }}>
          <b style={{ color: "var(--ink)" }}>This package isn&apos;t available anymore.</b>
          <Link href="/mentors" className="btn btn-primary">Browse mentors</Link>
        </div>
      </div>
    );
  }
  if (!gig) return <div className="page-narrow text-muted">Loading…</div>;

  const seller = gig.seller;

  return (
    <div className="page-mid">
      <button onClick={() => router.back()} className="btn btn-ghost btn-sm" style={{ marginBottom: 20, paddingLeft: 0 }}>
        ← Back
      </button>
      <h1 className="page-title" style={{ marginBottom: 28 }}>Confirm and pay</h1>

      {cancelled && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          Payment was cancelled, so you haven&apos;t been charged. You can try again below.
        </div>
      )}

      <div className="order-grid">
        <div className="stack">
          {/* Mentor */}
          <div className="card row" style={{ gap: 16 }}>
            {seller.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.photoUrl} alt="" className="avatar" style={{ width: 64, height: 64, objectFit: "cover" }} />
            ) : (
              <span className="avatar" style={{ width: 64, height: 64, fontSize: 24, background: tintFor(seller.id) }}>{initialsOf(seller.name)}</span>
            )}
            <div className="stack-sm grow" style={{ gap: 4 }}>
              <div className="row-wrap">
                <b style={{ fontSize: 18 }}>{seller.name}</b>
                <Vetted />
              </div>
              {seller.credential && <span className="text-secondary">{seller.credential}</span>}
            </div>
            <Link href={`/mentors/${seller.id}`} className="link small">View profile</Link>
          </div>

          {/* Package */}
          <div className="card stack">
            <b style={{ fontSize: 19 }}>{gig.title}</b>
            <div className="pkg-meta">
              {gig.service && <span className="badge badge-brand">{serviceLabel(gig.service, gig.serviceOther)}</span>}
              {gig.format && <span className="badge badge-blue">{labelFor(FORMATS, gig.format)}</span>}
              {gig.turnaround && <span className="badge">{labelFor(TURNAROUNDS, gig.turnaround)}</span>}
            </div>
            <p className="text-secondary" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{gig.description}</p>
            {gig.callsIncluded > 0 && (
              <div className="alert alert-blue row" style={{ alignItems: "flex-start" }}>
                <Icon d={ICONS.calendar} />
                <span>
                  Includes {gig.callsIncluded} × {gig.callLength}-minute call{gig.callsIncluded > 1 ? "s" : ""}. After you pay, you&apos;ll book
                  {gig.callsIncluded > 1 ? " them" : " it"} from {seller.name.split(" ")[0]}&apos;s open times on your order page, before your due date. Calls happen in a private MentorsMD video room.
                </span>
              </div>
            )}
            {gig.callsIncluded > 0 && <p className="notice">{RECORDING_NOTICE}</p>}
          </div>

          <div className="card stack">
            <div className="stack-sm">
              <span className="field-label">Due date</span>
              <span className="field-help">When you need the work back. Agree on it with your mentor in messages first.</span>
              {rules && <span className="text-secondary small">{rules.explanation}</span>}
            </div>
            {rules ? (
              <div className="picker-wrap">
                <DatePicker
                  value={dueDate}
                  onChange={(d) => { setDueDate(d); setError(""); }}
                  min={rules.earliest}
                  max={rules.latest}
                  initialMonth={rules.earliest}
                  isDisabled={(d) => rules.busy.some((b) => d >= b.startDay && d <= b.endDay)}
                  label="Due date"
                />
                {dueDate && (
                  <div className="stack-sm">
                    <span className="text-muted">Selected</span>
                    <b style={{ fontSize: 18 }}>{fmtDayLabel(dueDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</b>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-muted">Loading dates…</span>
            )}
          </div>
        </div>

        <aside className="sticky-side">
          <div className="card stack" style={{ boxShadow: "var(--shadow)" }}>
            <div className="between">
              <span className="text-secondary">Package</span>
              <span>{money(gig.price)}</span>
            </div>
            <hr className="divider" />
            <div className="between" style={{ fontSize: 18, fontWeight: 700 }}>
              <span>Total today</span>
              <span>${(gig.price / 100).toFixed(2)}</span>
            </div>
            {error && <div role="alert" className="alert alert-danger">{error}</div>}
            <button onClick={handleConfirm} disabled={paying} className="btn btn-primary btn-lg btn-block">
              {paying ? "Redirecting to payment…" : `Pay $${(gig.price / 100).toFixed(2)}`}
            </button>
            <div className="stack-sm text-secondary" style={{ fontSize: 14 }}>
              <span className="row strong" style={{ color: "var(--ink)" }}><Icon d={ICONS.lock} size={16} /> Payment held until you approve</span>
              <span>
                MentorsMD holds your payment, not the mentor. It&apos;s released when you approve the work, or automatically 96 hours after delivery. You can ask for a revision or raise an issue before then.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
