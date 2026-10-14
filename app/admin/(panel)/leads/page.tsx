import { Suspense } from "react";
import { LeadsInbox } from "@/components/admin/sections/LeadsInbox";

export const metadata = { title: "Leads · Admin · MentorsMD" };

// Admin -> Leads: mentor applications, contact messages and waitlist
// signups in one place (components/admin/sections/LeadsInbox.tsx).
export default function AdminLeadsPage() {
  return (
    <Suspense fallback={<div className="page text-muted">Loading…</div>}>
      <LeadsInbox />
    </Suspense>
  );
}
