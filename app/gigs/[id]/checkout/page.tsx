"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const gigId = params.id as string;

  const [gig, setGig] = useState<any>(null);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const minDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetch("/api/gigs")
      .then((res) => res.json())
      .then((data) => setGig(data.gigs.find((g: any) => g.id === gigId)));
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
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setPaying(false);
      return;
    }

    // Real Stripe Checkout page - this is the actual payment step, not a
    // simulation, unlike the earlier clickable prototype.
    window.location.href = data.url;
  }

  if (!gig) return <p className="text-muted">Loading...</p>;

  return (
    <div>
      <button onClick={() => router.back()} className="btn" style={{ marginBottom: 16, background: "none", border: "none", padding: 0 }}>
        &larr; Back
      </button>
      <div className="card-narrow">
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{gig.title}</div>
        <p className="text-secondary" style={{ lineHeight: 1.5, marginBottom: 18 }}>{gig.description}</p>

        <label className="text-secondary" style={{ display: "block", marginBottom: 6 }}>Due date</label>
        <input type="date" min={minDate} value={dueDate} onChange={(e) => { setDueDate(e.target.value); setError(""); }} className="input" />

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, padding: "10px 0", borderTop: "1px solid #D8E2DC", marginTop: 6, marginBottom: 16 }}>
          <span>Total due today</span><span>${(gig.price / 100).toFixed(2)}</span>
        </div>

        {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button onClick={handleConfirm} disabled={paying} className="btn-primary">
          {paying ? "Redirecting to payment..." : `Pay $${(gig.price / 100).toFixed(2)}`}
        </button>
        <p className="text-muted" style={{ textAlign: "center", marginTop: 10 }}>Held securely until the work is delivered</p>
      </div>
    </div>
  );
}
