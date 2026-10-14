"use client";

import { MentorInvites } from "@/components/admin/sections/MentorInvites";

export default function AdminMentorsPage() {
  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Mentors</h1>
        <p className="lede">Mentors are invite-only. Invite someone by email, resend or cancel invites, and see who has joined.</p>
      </div>
      <MentorInvites />
    </div>
  );
}
