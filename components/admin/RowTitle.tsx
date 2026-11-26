import type { ReactNode } from "react";

// The title of an expandable admin row (<Collapsible variant="row"
// className="adm-row">): a bold name with a muted line under it. Leads,
// Mentor applications, Under 18 and Legal versions all use it, so their
// rows look the same.
export function RowTitle({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <span className="adm-row-title">
      <b>{title}</b>
      {sub && <span className="text-muted">{sub}</span>}
    </span>
  );
}
