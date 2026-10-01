"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Icon, ICONS, Vetted, tintFor, initialsOf } from "@/components/ui";
import { FORMATS, SERVICES, TURNAROUNDS, labelFor, money } from "@/lib/options";

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
  const minDate = new Date().toISOString().split("T")[0];

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
          <Link href="/coaches" className="btn btn-primary">Browse mentors</Link>
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
            <Link href={`/coaches/${seller.id}`} className="link small">View profile</Link>
          </div>

          {/* Package */}
          <div className="card stack">
            <b style={{ fontSize: 19 }}>{gig.title}</b>
            <div className="pkg-meta">
              {gig.service && <span className="badge badge-brand">{labelFor(SERVICES, gig.service)}</span>}
              {gig.format && <span className="badge badge-blue">{labelFor(FORMATS, gig.format)}</span>}
              {gig.turnaround && <span className="badge">{labelFor(TURNAROUNDS, gig.turnaround)}</span>}
            </div>
            <p className="text-secondary" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{gig.description}</p>
            {gig.callsIncluded > 0 && (
              <div className="alert alert-blue row" style={{ alignItems: "flex-start" }}>
                <Icon d={ICONS.calendar} />
                <span>
                  Includes {gig.callsIncluded} × {gig.callLength}-minute call{gig.callsIncluded > 1 ? "s" : ""}. After you pay, you&apos;ll book
                  {gig.callsIncluded > 1 ? " them" : " it"} on {seller.name.split(" ")[0]}&apos;s calendar from your order page, before your due date.
                </span>
              </div>
            )}
          </div>

          <div className="card stack">
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Due date</span>
              <span className="field-help">When you need the work back. Agree on it with your mentor in messages first.</span>
              <input
                type="date"
                min={minDate}
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setError("");
                }}
                className="input"
                style={{ maxWidth: 260 }}
              />
            </label>
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
