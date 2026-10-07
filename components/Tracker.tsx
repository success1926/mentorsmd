"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ATTRIBUTION_MAX_AGE, SOURCE_COOKIE, VISITOR_COOKIE, encodeSourceCookie, sourceFromVisit } from "@/lib/attribution";

// First-party visit tracking for Admin -> Insights (#83, #86). No outside
// service. On the first visit it stores a random visitor id and how the
// visitor arrived (see lib/attribution.ts), then logs one visit per
// browser session. Mentor profile pages log a view with trackEvent().

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? m[1] : null;
}

function writeCookie(name: string, value: string) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${ATTRIBUTION_MAX_AGE}; SameSite=Lax${secure}`;
}

function randomId() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

// Makes sure both cookies exist before anything is logged.
function ensureCookies() {
  if (!readCookie(VISITOR_COOKIE)) writeCookie(VISITOR_COOKIE, randomId());
  if (!readCookie(SOURCE_COOKIE)) writeCookie(SOURCE_COOKIE, encodeSourceCookie(sourceFromVisit(location.href, document.referrer)));
}

function isAutomated() {
  try {
    return !!(navigator as any).webdriver;
  } catch {
    return false;
  }
}

export function trackEvent(body: { kind: "VISIT"; path: string } | { kind: "PROFILE_VIEW"; mentorId: string }) {
  if (typeof window === "undefined" || isAutomated()) return;
  try {
    ensureCookies();
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
  } catch {
    // never let tracking break a page
  }
}

export function Tracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (isAutomated()) return;
    try {
      ensureCookies();
      // One visit per browser tab session.
      if (sessionStorage.getItem("mmd_visit")) return;
      sessionStorage.setItem("mmd_visit", "1");
    } catch {
      return;
    }
    trackEvent({ kind: "VISIT", path: pathname || "/" });
    // only on the first page of the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
