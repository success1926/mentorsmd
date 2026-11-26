import { Suspense } from "react";
import { LeadsInbox } from "@/components/admin/sections/LeadsInbox";
import { LoadingBlock } from "@/components/ui";

export const metadata = { title: "Leads" };

// Admin -> Leads: mentor applications, contact messages and waitlist
// signups in one place (components/admin/sections/LeadsInbox.tsx).
export default function AdminLeadsPage() {
  return (
    <Suspense fallback={<div className="page"><LoadingBlock lines={5} /></div>}>
      <LeadsInbox />
    </Suspense>
  );
}
