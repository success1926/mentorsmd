"use client";

import { Icon, ICONS } from "@/components/ui";
import { deliveryFileHref, deliveryFiles } from "@/lib/deliveries";
import { fmtDateTime } from "@/lib/format";

// One delivery from the mentor (orders from before the hourly redesign):
// their note and any files. Admin -> Disputes shows these.
export function DeliveryCard({ delivery, latest, children }: { delivery: any; latest: boolean; children?: React.ReactNode }) {
  const files = deliveryFiles(delivery.files);
  return (
    <div className="card stack-sm" style={latest ? { borderColor: "var(--tint-2)" } : undefined}>
      <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
        <b className="row" style={{ gap: 8 }}><Icon d={ICONS.doc} size={18} /> Delivery {delivery.number}</b>
        <span className="row" style={{ gap: 8 }}>
          {latest && <span className="badge badge-brand">Latest</span>}
          <span className="text-muted">{fmtDateTime(delivery.createdAt)}</span>
        </span>
      </div>
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{delivery.description}</p>
      {files.length > 0 && (
        <div className="stack-sm" style={{ gap: 4 }}>
          {files.map((f, i) => (
            <a key={i} href={deliveryFileHref(delivery.id, i)} target="_blank" rel="noopener noreferrer" className="link small">
              📎 {f.name}
            </a>
          ))}
        </div>
      )}
      {children && (
        <>
          <hr className="divider" />
          {children}
        </>
      )}
    </div>
  );
}
