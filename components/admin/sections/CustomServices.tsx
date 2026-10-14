"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Admin -> Services: what mentors typed when they picked "Other".
export function CustomServices() {
  const [services, setServices] = useState<any[] | null>(null);
  useEffect(() => {
    fetch("/api/admin/custom-services").then((r) => r.json()).then((d) => setServices(d.services || [])).catch(() => setServices([]));
  }, []);
  return (
    <section className="stack-sm">
      <h2 style={{ fontSize: 30 }}>Custom services</h2>
      <p className="text-secondary">What mentors typed when they picked &quot;Other&quot;. If several mentors offer the same thing, it may be worth adding as an official service.</p>
      <div className="card" style={{ padding: "6px 20px" }}>
        {services === null && <p className="text-muted" style={{ padding: "12px 0" }}>Loading…</p>}
        {services?.length === 0 && <p className="text-muted" style={{ padding: "12px 0" }}>No &quot;Other&quot; packages yet.</p>}
        {services?.map((s) => (
          <details key={s.name} className="list-row" style={{ display: "block" }}>
            <summary className="between" style={{ cursor: "pointer" }}>
              <b style={{ fontSize: 15 }}>{s.name}</b>
              <span className="text-muted">{s.mentors} mentor{s.mentors === 1 ? "" : "s"} · {s.packages} package{s.packages === 1 ? "" : "s"}</span>
            </summary>
            <div className="stack-sm" style={{ padding: "8px 0 4px" }}>
              {s.examples.map((e: any) => (
                <Link key={e.id} href={`/mentors/${e.sellerId}#pkg-${e.id}`} className="link small">
                  {e.title} ({e.mentor})
                </Link>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
