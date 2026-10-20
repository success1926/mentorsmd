"use client";

import Link from "next/link";
import { Icon } from "@/components/ui";
import { AreaShell, CountBadge, UnreadBadge } from "@/components/AreaShell";
import { useNavStatus, type MentorStatus } from "@/components/NavStatus";
import { MENTOR_NAV, isMentorNavActive, previewHref } from "@/lib/mentorNav";

// Mentor area layout (mentor area v2, Oct 2026): the shared sidebar
// (components/AreaShell.tsx) with the mentor's links (lib/mentorNav.ts),
// badges and the "Hidden from Browse / Live on Browse" card. The numbers
// come from the page's one status load (components/NavStatus.tsx).

export type { MentorStatus } from "@/components/NavStatus";
export { notifyProfileChanged } from "@/components/NavStatus";

// The sidebar's data, for pages that want the same numbers.
export function useMentorStatus() {
  const s = useNavStatus();
  return s ? { unread: s.unread, mentor: s.mentor } : null;
}

// "Hidden from Browse" / "Live on Browse" / "Paused", with a preview link.
export function BrowseStatusCard({ mentor }: { mentor: MentorStatus }) {
  const [tone, title, text] = mentor.removed
    ? ["danger", "Profile removed", "Restore it in Settings."]
    : mentor.safetyHold
      ? ["warn", "Hidden from Browse", "Paused by MentorsMD for a safety review."]
      : !mentor.progress.complete
        ? ["warn", "Hidden from Browse", "Finish your profile to go live."]
        : mentor.paused
          ? ["warn", "Paused", "Hidden from Browse until you're back."]
          : !mentor.listed
            ? ["warn", "Hidden from Browse", "Save any step of My profile to go live."]
            : !mentor.payoutsStarted
              ? ["warn", "Live on Browse", "Students can find you. Set up payouts so they can buy."]
              : ["ok", "Live on Browse", "Students can find and book you."];
  return (
    <div className="mentor-status-card">
      <span className="row" style={{ gap: 8 }}>
        <span className={`mentor-status-dot ${tone}`} aria-hidden="true" />
        <b>{title}</b>
      </span>
      <span className="text-secondary">{text}</span>
      <Link href={previewHref(mentor.id)} className="link">Preview my profile</Link>
    </div>
  );
}

export function MentorShell({ children }: { children: React.ReactNode }) {
  const data = useMentorStatus();
  const mentor = data?.mentor ?? null;

  return (
    <AreaShell
      id="mentor"
      label="Mentor area"
      role="Mentor workspace"
      person={mentor}
      nav={MENTOR_NAV}
      isActive={isMentorNavActive}
      badge={(n) => {
        if (n.key === "students" && mentor && mentor.activePackages > 0) return <CountBadge n={mentor.activePackages} label="active" />;
        if (n.key === "messages" && data && data.unread > 0) return <UnreadBadge n={data.unread} />;
        if (n.key === "profile" && mentor && !mentor.progress.complete) return <span className="mentor-nav-pill">{mentor.progress.done} of {mentor.progress.total}</span>;
        return null;
      }}
      card={mentor && <BrowseStatusCard mentor={mentor} />}
    >
      {children}
    </AreaShell>
  );
}

// Small "Preview my profile" button used on several mentor pages.
export function PreviewProfileButton({ mentorId, className = "btn btn-sm", label = "Preview my profile" }: { mentorId: string | undefined; className?: string; label?: string }) {
  if (!mentorId) return null;
  return (
    <Link href={previewHref(mentorId)} className={className}>
      <Icon d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z" size={16} /> {label}
    </Link>
  );
}
