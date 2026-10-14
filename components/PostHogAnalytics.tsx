"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type { CaptureResult, PostHog } from "posthog-js";

// Visitor analytics (PostHog) for Admin -> Analytics. Separate from the
// site's own first-party visit log (components/Tracker.tsx), which keeps
// working as before.
//
// Off unless NEXT_PUBLIC_POSTHOG_KEY is set (set it for Production only,
// so previews send nothing). Privacy rules, because many students are
// under 18:
//  - Logged-in people are identified by their internal user id and role
//    only (never name, email or date of birth). Visitors who aren't logged
//    in stay anonymous (no person profile).
//  - Admins' own browsing is not counted (opted out on their browser).
//  - Session recordings only on public marketing pages and only for
//    visitors who aren't logged in. Everything typed is masked, and
//    anything marked `ph-no-capture` (message threads) is never captured.
//  - On account pages, clicks are counted without the words on the button
//    (which can be people's names).
//  - Do Not Track is respected. Tokens in addresses (consent links,
//    password resets, invites) are removed before anything is sent.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// Pages where a session recording may run (logged-out visitors only).
const RECORDABLE = [/^\/$/, /^\/mentors(\/[^/]+)?\/?$/, /^\/senior-team\/?$/, /^\/become-a-mentor\/?$/, /^\/contact\/?$/, /^\/signup\/?$/, /^\/login\/?$/];
const recordable = (path: string) => RECORDABLE.some((r) => r.test(path));

// Paths whose last part is a private token.
const TOKEN_PATHS = /\/(consent|parent)\/[^/?#"'\s]+/g;
// Query values that must never leave the browser.
const SECRET_PARAMS = /([?&])(token|code|email|callbackUrl|mfaTicket)=[^&#"'\s]*/gi;

// Our own addresses: keep only utm_ tags from the query string, hide tokens in the path.
function cleanUrl(value: string): string {
  try {
    const u = new URL(value, window.location.origin);
    if (u.origin !== window.location.origin) return value.replace(SECRET_PARAMS, "$1$2=hidden");
    const keep = new URLSearchParams();
    u.searchParams.forEach((v, k) => {
      if (k.toLowerCase().startsWith("utm_")) keep.set(k, v);
    });
    const q = keep.toString();
    return `${u.origin}${u.pathname.replace(TOKEN_PATHS, "/$1/[token]")}${q ? `?${q}` : ""}`;
  } catch {
    return value.replace(TOKEN_PATHS, "/$1/[token]").replace(SECRET_PARAMS, "$1$2=hidden");
  }
}

const URL_KEYS = /(url|referrer)$/i;
function cleanProps(props: Record<string, any> | undefined) {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (typeof v !== "string") continue;
    if (URL_KEYS.test(k) && /^(https?:\/\/|\/)/.test(v)) props[k] = cleanUrl(v);
    else if (/pathname$/i.test(k)) props[k] = v.replace(TOKEN_PATHS, "/$1/[token]");
    else props[k] = v.replace(TOKEN_PATHS, "/$1/[token]").replace(SECRET_PARAMS, "$1$2=hidden");
  }
}

function beforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  // Nothing from the admin area, even before an admin logs in.
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) return null;
  cleanProps(event.properties);
  // Clicks on account pages (orders, messages, dashboard...) keep which
  // button was clicked but not the words on it, which can be people's names.
  if (event.event === "$autocapture" && !recordable(window.location.pathname)) {
    delete event.properties.$el_text;
    if (typeof event.properties.$elements_chain === "string") {
      event.properties.$elements_chain = event.properties.$elements_chain.replace(/text="(?:[^"\\]|\\.)*"/g, 'text=""');
    }
    if (Array.isArray(event.properties.$elements)) {
      for (const el of event.properties.$elements) if (el && typeof el === "object") delete el.$el_text;
    }
  }
  cleanProps(event.$set);
  cleanProps(event.$set_once);
  return event;
}

const ROLE: Record<string, string> = { BUYER: "student", SELLER: "mentor", ADMIN: "admin", ADMIN_2FA: "admin" };

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
// `admin`: an admin's first load starts opted out, so not even one page view is sent.
function load(admin: boolean): Promise<PostHog | null> {
  if (!KEY || typeof window === "undefined") return Promise.resolve(null);
  if (!loading) {
    loading = import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(KEY, {
          api_host: HOST,
          person_profiles: "identified_only",
          capture_pageview: "history_change",
          capture_pageleave: true,
          autocapture: true,
          respect_dnt: true,
          disable_surveys: true,
          // Recordings are started and stopped page by page below.
          disable_session_recording: true,
          session_recording: { maskAllInputs: true, blockClass: "ph-no-capture" },
          before_send: beforeSend,
          opt_out_capturing_by_default: admin,
        });
        client = posthog;
        return posthog;
      })
      .catch(() => null);
  }
  return loading;
}

export function PostHogAnalytics() {
  const pathname = usePathname() || "/";
  const { data: session, status } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;
  const identified = useRef<string | null>(null);

  // Stop a recording in the same moment a non-public page appears, before
  // the recorder can see it (layout effects run before the browser paints).
  const allowRecording = status === "unauthenticated" && recordable(pathname);
  useLayoutEffect(() => {
    if (!allowRecording && client?.sessionRecordingStarted()) client.stopSessionRecording();
  }, [allowRecording]);

  useEffect(() => {
    if (!KEY || status === "loading") return;
    let cancelled = false;
    const isAdmin = !!role && ROLE[role] === "admin";
    load(isAdmin).then((ph) => {
      if (!ph || cancelled) return;
      try {
        if (isAdmin) {
          // Keep the team's own browsing out of the numbers (remembered on this browser).
          ph.opt_out_capturing();
          if (ph.sessionRecordingStarted()) ph.stopSessionRecording();
          return;
        }
        if (status === "authenticated" && userId) {
          if (identified.current !== userId) {
            ph.identify(userId, { role: (role && ROLE[role]) || "student" });
            identified.current = userId;
          }
        } else if (status === "unauthenticated" && identified.current) {
          ph.reset(); // logged out: the next visitor on this browser starts fresh
          identified.current = null;
        }
        if (allowRecording && !ph.has_opted_out_capturing()) {
          if (!ph.sessionRecordingStarted()) ph.startSessionRecording();
        } else if (ph.sessionRecordingStarted()) {
          ph.stopSessionRecording();
        }
      } catch {
        // never let analytics break a page
      }
    });
    return () => {
      cancelled = true;
    };
  }, [status, userId, role, allowRecording]);

  return null;
}
