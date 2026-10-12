"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Modal } from "@/components/Modal";
import { ADMIN_IDLE_MS, ADMIN_WARN_BEFORE_MS } from "@/lib/sessionRules";

// Watches the login session in the browser:
//  1. If a session ends on its own (timed out, or ended elsewhere) while a
//     private page is open, go to the login page with a short explanation,
//     then come back to the same page after logging in.
//  2. Admins: log out after 1 hour with no activity, with a "Still there?"
//     warning 2 minutes before. Activity in any open tab counts.
//
// A deliberate "Log out" clears the marker first, so it never shows the
// inactivity message. next-auth itself logs out the other open tabs.

const WAS_LOGGED_IN = "mmd_was_logged_in";
const LAST_ACTIVITY = "mmd_last_activity";
const PROTECTED = ["/account", "/dashboard", "/messages", "/orders", "/admin", "/gigs"];

function store(key: string, value?: string) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function markLoggedOutOnPurpose() {
  store(WAS_LOGGED_IN);
  // This tab is about to navigate away by itself; don't redirect it.
  try {
    sessionStorage.setItem("mmd_logging_out", "1");
  } catch {}
}

function loggingOutHere() {
  try {
    return sessionStorage.getItem("mmd_logging_out") === "1";
  } catch {
    return false;
  }
}

export function SessionWatcher() {
  const { data: session, status, update } = useSession();
  const role = (session?.user as any)?.role;
  const pathname = usePathname() || "/";
  const router = useRouter();

  // ---- 1. Session ended while a private page was open ----
  useEffect(() => {
    if (status === "authenticated") {
      store(WAS_LOGGED_IN, "1");
      try {
        sessionStorage.removeItem("mmd_logging_out");
      } catch {}
      return;
    }
    if (status !== "unauthenticated" || loggingOutHere()) return;
    const params = new URLSearchParams(window.location.search);
    if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      // Reload this private page so the server (middleware.ts) sends it to
      // the login page with the right explanation. Also covers logging out
      // in another tab. Throttled so a network hiccup can't cause a loop.
      let last = 0;
      try {
        last = Number(sessionStorage.getItem("mmd_reload_at")) || 0;
        if (Date.now() - last > 30_000) sessionStorage.setItem("mmd_reload_at", String(Date.now()));
      } catch {}
      if (Date.now() - last > 30_000) window.location.replace(window.location.href);
      return;
    }
    if (read(WAS_LOGGED_IN) === "1") {
      store(WAS_LOGGED_IN);
      if (pathname === "/login" && !params.get("reason")) {
        // The login ran out (the server had nothing left to explain why).
        params.set("reason", "idle");
        router.replace(`/login?${params.toString()}`);
      }
    }
  }, [status, pathname, router]);

  // ---- 1b. Admins finish 2-step verification before using Admin ----
  useEffect(() => {
    if (role === "ADMIN_2FA" && pathname.startsWith("/admin") && pathname !== "/admin/verify") router.replace("/admin/verify");
  }, [role, pathname, router]);

  // ---- 2. Admin inactivity timer ----
  // Based on the role alone: status briefly reads "loading" while update()
  // runs, and that must not restart the timer.
  const isAdmin = role === "ADMIN";
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const lastLocal = useRef(Date.now());
  const lastKeepAlive = useRef(Date.now());
  // update() changes identity whenever the session does; keep it in a ref
  // so the timer effect below doesn't restart (and re-call it) in a loop.
  const updateRef = useRef(update);
  updateRef.current = update;

  const lastActivity = useCallback(() => Math.max(lastLocal.current, Number(read(LAST_ACTIVITY)) || 0), []);

  const stayLoggedIn = useCallback(() => {
    lastLocal.current = Date.now();
    store(LAST_ACTIVITY, String(lastLocal.current));
    lastKeepAlive.current = Date.now();
    setWarning(false);
    updateRef.current().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    lastLocal.current = Date.now();
    store(LAST_ACTIVITY, String(lastLocal.current));
    // Opening or reloading an admin page counts as activity on the server too.
    lastKeepAlive.current = Date.now();
    updateRef.current().catch(() => {});

    let lastWrite = 0;
    const onActivity = () => {
      lastLocal.current = Date.now();
      // Share with other tabs, at most every 15 seconds.
      if (lastLocal.current - lastWrite > 15_000) {
        lastWrite = lastLocal.current;
        store(LAST_ACTIVITY, String(lastLocal.current));
      }
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = setInterval(() => {
      const idle = Date.now() - lastActivity();
      if (idle >= ADMIN_IDLE_MS) {
        clearInterval(tick);
        markLoggedOutOnPurpose(); // the login page explains why instead
        signOut({ callbackUrl: `/login?reason=idle&callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}` });
        return;
      }
      if (idle >= ADMIN_IDLE_MS - ADMIN_WARN_BEFORE_MS) {
        setWarning(true);
        setSecondsLeft(Math.max(0, Math.ceil((ADMIN_IDLE_MS - idle) / 1000)));
        return;
      }
      setWarning(false);
      // Active: tell the server every 5 minutes so the login stays valid.
      if (Date.now() - lastKeepAlive.current > 5 * 60_000 && idle < 5 * 60_000) {
        lastKeepAlive.current = Date.now();
        updateRef.current().catch(() => {});
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [isAdmin, lastActivity]);

  if (!isAdmin) return null;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");
  return (
    <Modal open={warning} onClose={stayLoggedIn} label="Still there?">
      <div className="stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 26 }}>Still there?</h2>
        <p className="text-secondary">
          For security, admins are logged out after an hour with no activity. You&apos;ll be logged out in{" "}
          <b>
            {mm}:{ss}
          </b>
          .
        </p>
        <div className="row">
          <button className="btn btn-primary" onClick={stayLoggedIn}>Stay logged in</button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              markLoggedOutOnPurpose();
              signOut({ callbackUrl: "/" });
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </Modal>
  );
}
