"use client";

import { People } from "@/components/admin/sections/People";

// Admin -> Everyone: mentors and students. Mentor invites are the next
// tab (/admin/mentors).
export default function AdminPeoplePage() {
  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Everyone</h1>
        <p className="lede">Every mentor and student: health, flags, pause, remove and restore.</p>
      </div>
      <People />
    </div>
  );
}
