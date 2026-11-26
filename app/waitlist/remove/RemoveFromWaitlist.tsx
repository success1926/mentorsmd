"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui";

export function RemoveFromWaitlist({ id, sig }: { id: string; sig: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  async function remove() {
    setState("busy");
    setError("");
    const res = await fetch("/api/waitlist/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, sig }),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) setState("done");
    else {
      setState("idle");
      setError(d.error || "Something went wrong. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="stack">
        <Alert tone="success">You&apos;re off the waitlist. We won&apos;t email you about it again.</Alert>
        <Link href="/mentors" className="btn" style={{ alignSelf: "flex-start" }}>Browse mentors</Link>
      </div>
    );
  }
  return (
    <div className="stack">
      {error && <Alert tone="danger">{error}</Alert>}
      <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={state === "busy" || !id || !sig} onClick={remove}>
        {state === "busy" ? "Removing…" : "Remove me from the waitlist"}
      </button>
    </div>
  );
}
