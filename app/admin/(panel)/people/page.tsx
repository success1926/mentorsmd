"use client";

import { People } from "@/components/admin/sections/People";
import { PageHeader } from "@/components/ui";

// Admin -> Everyone: mentors and students. Mentor invites are the next
// tab (/admin/mentors).
export default function AdminPeoplePage() {
  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <PageHeader title="Everyone" lede="Every mentor and student: health, flags, pause, remove and restore." />
      <People />
    </div>
  );
}
