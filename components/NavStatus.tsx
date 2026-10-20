"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { onLive } from "@/lib/realtimeClient";

// The small status from /api/me/nav (unread messages; for mentors their
// profile progress and Browse status; for students packages, calls and
// credit), loaded ONCE per page for everything that shows it: the top bar,
// the mentor and student sidebars, My profile and the student Home.
// Refreshed on every page change, every minute, when the tab regains
// focus, when a message arrives, and on these events:
//   mmd:unread-changed    a thread was read
//   mmd:profile-changed   the mentor saved a profile step (notifyProfileChanged)
//   mmd:packages-changed  a student's package changed (notifyPackagesChanged)

export type MentorStatus = {
  id: string;
  name: string;
  photoUrl: string | null;
  activePackages: number;
  progress: { done: number; total: number; complete: boolean; missing: string[] };
  listed: boolean;
  paused: boolean;
  removed: boolean;
  safetyHold: boolean;
  payoutsStarted: boolean;
};

export type StudentStatus = {
  name: string;
  photoUrl: string | null;
  activePackages: number;
  waiting: number;
  upcomingCalls: number;
  creditCents: number;
};

export type NavStatus = {
  unread: number;
  unreadConversations: number;
  mentor: MentorStatus | null;
  student: StudentStatus | null;
};

const EVENTS = ["focus", "mmd:unread-changed", "mmd:profile-changed", "mmd:packages-changed"];

const NavStatusContext = createContext<NavStatus | null>(null);

export function NavStatusProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  const pathname = usePathname();
  const [data, setData] = useState<NavStatus | null>(null);

  useEffect(() => {
    // Admins have their own panel; logged-out visitors have nothing to show.
    if (status !== "authenticated" || role === "ADMIN" || role === "ADMIN_2FA") {
      setData(null);
      return;
    }
    let alive = true;
    const load = () =>
      fetch("/api/me/nav")
        .then((r) => r.json())
        .then((d) => alive && setData({ unread: d.unread || 0, unreadConversations: d.unreadConversations || 0, mentor: d.mentor || null, student: d.student || null }))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    for (const e of EVENTS) window.addEventListener(e, load);
    // A new message arrived (live updates, lib/realtimeClient.ts). Waits a
    // moment so an open thread can mark it read first.
    let liveTimer: ReturnType<typeof setTimeout> | undefined;
    const off = onLive((event) => {
      if (event !== "message") return;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(load, 1500);
    });
    return () => {
      alive = false;
      off();
      clearTimeout(liveTimer);
      clearInterval(timer);
      for (const e of EVENTS) window.removeEventListener(e, load);
    };
  }, [status, role, pathname]);

  return <NavStatusContext.Provider value={data}>{children}</NavStatusContext.Provider>;
}

// null until the first load (and for logged-out visitors and admins).
export function useNavStatus() {
  return useContext(NavStatusContext);
}

// Call after saving anything that changes the mentor's profile checklist.
export function notifyProfileChanged() {
  window.dispatchEvent(new Event("mmd:profile-changed"));
}

// Call after anything that changes a student's sidebar numbers (approving
// a package, booking or cancelling a call).
export function notifyPackagesChanged() {
  window.dispatchEvent(new Event("mmd:packages-changed"));
}
