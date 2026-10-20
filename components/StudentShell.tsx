"use client";

import Link from "next/link";
import { AreaShell, CountBadge, UnreadBadge } from "@/components/AreaShell";
import { useNavStatus } from "@/components/NavStatus";
import { STUDENT_NAV, isStudentNavActive } from "@/lib/studentNav";
import { money } from "@/lib/options";

// Student area layout (student area v2, Oct 2026): the shared sidebar
// (components/AreaShell.tsx, same as the mentor area) with the student's
// links (lib/studentNav.ts) and badges. The numbers come from the page's
// one status load (components/NavStatus.tsx).

export type { StudentStatus } from "@/components/NavStatus";
export { notifyPackagesChanged } from "@/components/NavStatus";

export function useStudentStatus() {
  const s = useNavStatus();
  return s ? { unread: s.unread, student: s.student } : null;
}

export function StudentShell({ children }: { children: React.ReactNode }) {
  const data = useStudentStatus();
  const student = data?.student ?? null;

  return (
    <AreaShell
      id="student"
      label="Student area"
      role="Student"
      person={student}
      nav={STUDENT_NAV}
      isActive={isStudentNavActive}
      badge={(n) => {
        if (n.key === "packages" && student && student.activePackages > 0) return <CountBadge n={student.activePackages} label="active" />;
        if (n.key === "messages" && data && data.unread > 0) return <UnreadBadge n={data.unread} />;
        if (n.key === "calendar" && student && student.upcomingCalls > 0) return <CountBadge n={student.upcomingCalls} label="upcoming" />;
        if (n.key === "credit" && student && student.creditCents > 0) return <span className="mentor-nav-pill ok">{money(student.creditCents)}</span>;
        if (n.key === "mentors") {
          return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--faint)" }}>
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          );
        }
        return null;
      }}
      card={
        <div className="mentor-status-card">
          <b>Not sure who to pick?</b>
          <span className="text-secondary">Book a free 15-minute intro call with any mentor first.</span>
          <Link href="/mentors" className="link">Browse mentors</Link>
        </div>
      }
    >
      {children}
    </AreaShell>
  );
}
