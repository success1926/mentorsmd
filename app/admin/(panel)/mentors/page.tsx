"use client";

import { MentorInvites } from "@/components/admin/sections/MentorInvites";
import { PageHeader } from "@/components/ui";
import { PeopleTabs } from "@/components/admin/AdminTabs";

// Admin -> Everyone -> Mentor invites.
export default function AdminMentorsPage() {
  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <PageHeader title="Everyone" lede="Mentors are invite-only. Invite someone by email, resend or cancel invites, and see who has joined." />
      <section className="stack-sm">
        <PeopleTabs />
        <MentorInvites />
      </section>
    </div>
  );
}
