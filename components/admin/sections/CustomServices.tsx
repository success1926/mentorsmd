"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Collapsible, EmptyState, LoadingBlock } from "@/components/ui";

// Admin -> Services: what mentors typed when they picked "Other". The only
// section on its page, so the page's own title is its heading.
export function CustomServices() {
  const [services, setServices] = useState<any[] | null>(null);
  useEffect(() => {
    fetch("/api/admin/custom-services").then((r) => r.json()).then((d) => setServices(d.services || [])).catch(() => setServices([]));
  }, []);
  return (
    <section className="stack-sm">
      <p className="text-secondary">If several mentors offer the same thing, it may be worth adding as an official service.</p>
      {services === null && <LoadingBlock lines={4} title={false} />}
      {services?.length === 0 && <EmptyState>No &quot;Other&quot; packages yet.</EmptyState>}
      {!!services?.length && (
        <div className="card" style={{ padding: "6px 20px" }}>
          {services.map((s) => (
            <Collapsible key={s.name} variant="row" title={s.name} meta={`${s.mentors} mentor${s.mentors === 1 ? "" : "s"} · ${s.packages} package${s.packages === 1 ? "" : "s"}`}>
              {s.examples.map((e: any) => (
                <Link key={e.id} href={`/mentors/${e.sellerId}#pkg-${e.id}`} className="link small">
                  {e.title} ({e.mentor})
                </Link>
              ))}
            </Collapsible>
          ))}
        </div>
      )}
    </section>
  );
}
