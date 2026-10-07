"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { browserTimeZone } from "@/lib/tz";

// Saves the browser's time zone on the account the first time someone is
// logged in on this browser (signup, login or Google). It never replaces
// a zone the person chose themselves on Account. Used for call reminders
// at 8am local time and for times in emails.
export function TimeZoneSync() {
  const { data: session, status } = useSession();
  const userId = (session?.user as any)?.id;
  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    const tz = browserTimeZone();
    if (!tz) return;
    const key = `mmd:tz:${userId}`;
    try {
      if (localStorage.getItem(key) === tz) return;
    } catch {}
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone: tz, onlyIfEmpty: true }),
    })
      .then((r) => {
        if (r.ok) {
          try {
            localStorage.setItem(key, tz);
          } catch {}
        }
      })
      .catch(() => {});
  }, [status, userId]);
  return null;
}
