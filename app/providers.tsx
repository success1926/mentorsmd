"use client";

import { SessionProvider } from "next-auth/react";
import { SessionWatcher } from "@/components/SessionWatcher";
import { TimeZoneSync } from "@/components/TimeZoneSync";
import { NavStatusProvider } from "@/components/NavStatus";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionWatcher />
      <TimeZoneSync />
      <NavStatusProvider>{children}</NavStatusProvider>
    </SessionProvider>
  );
}
