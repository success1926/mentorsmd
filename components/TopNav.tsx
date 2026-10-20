"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { markLoggedOutOnPurpose } from "@/components/SessionWatcher";
import { MENTOR_QUICK_LINKS, quickLinkHref } from "@/lib/options";
import { onLive } from "@/lib/realtimeClient";
import { MENTOR_NAV, previewHref } from "@/lib/mentorNav";
import { STUDENT_NAV } from "@/lib/studentNav";

// The brand mark: a graduation cap whose tassel is a stethoscope.
// Same drawing as app/icon.svg (browser tab) - keep the two in step.
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M17 28v10c0 8 30 8 30 0V28l-15 7z" fill="#5536D6" />
      <path d="M32 7l28 14-28 14L4 21z" fill="#2B1F6B" />
      <circle cx="32" cy="21" r="2.6" fill="#F07FA6" />
      <path d="M32 21l21 4.5V40" fill="none" stroke="#F07FA6" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="53" cy="46" r="5.5" fill="#F07FA6" />
      <circle cx="53" cy="46" r="2.2" fill="#fff" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="MentorsMD home">
      <LogoMark />
      <span>Mentors<b>MD</b></span>
    </Link>
  );
}

type NavLink = { label: string; href: string };
// midHide: hidden on the bar at in-between (small laptop) widths so it
// fits on one line; always in the phone menu.
type MainLink = NavLink & { midHide?: boolean; reviews?: boolean };

// The general pages, in order (as on AdmitMD: a row of real pages).
// "Reviews" only shows once the homepage shows its review wall.
const LOGGED_OUT_LINKS: MainLink[] = [
  { label: "Home", href: "/", midHide: true },
  { label: "Browse mentors", href: "/mentors" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Senior team", href: "/senior-team", midHide: true },
  { label: "Reviews", href: "/reviews", reviews: true },
  { label: "Become a mentor", href: "/become-a-mentor" },
];
// Logged-in students keep their shorter list (their own links sit on the right).
const STUDENT_LINKS: MainLink[] = [
  { label: "Browse mentors", href: "/mentors" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Reviews", href: "/reviews", reviews: true },
  { label: "Become a mentor", href: "/become-a-mentor" },
];
const OTHER_LINKS: MainLink[] = [{ label: "Browse mentors", href: "/mentors" }];

const RIGHT_LINKS: Record<string, NavLink[]> = {
  BUYER: [
    { label: "My packages", href: "/orders" },
    { label: "Messages", href: "/messages" },
  ],
  // Mentors: "View my public profile" (added below, it needs their id).
  // Everything else is in the mentor area sidebar (lib/mentorNav.ts).
  SELLER: [],
  ADMIN: [{ label: "Admin", href: "/admin" }],
  ADMIN_2FA: [{ label: "Finish logging in", href: "/admin/verify" }],
};

const MENU: Record<string, NavLink[]> = {
  // The student area's pages (the same list as its sidebar, lib/studentNav.ts).
  BUYER: [...STUDENT_NAV.map((n) => ({ label: n.label, href: n.href })), { label: "Contact us", href: "/contact" }],
  // The mentor area's pages (the same list as its sidebar).
  SELLER: [...MENTOR_NAV.map((n) => ({ label: n.label, href: n.href })), { label: "Contact us", href: "/contact" }],
  ADMIN: [
    { label: "Admin", href: "/admin" },
    { label: "Team", href: "/admin/team" },
    { label: "Account settings", href: "/account" },
  ],
  ADMIN_2FA: [{ label: "Finish logging in", href: "/admin/verify" }],
};

const ROLE_LABEL: Record<string, string> = { BUYER: "Student account", SELLER: "Mentor account", ADMIN: "Admin", ADMIN_2FA: "Admin (verification needed)" };

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

// A deliberate log out (as opposed to timing out). Clears the "was
// logged in" marker first so no tab shows the inactivity message, and
// next-auth tells the other open tabs to log out too.
export function logOut(callbackUrl: string = "/") {
  markLoggedOutOnPurpose();
  signOut({ callbackUrl });
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function TopNav({ showReviews = false }: { showReviews?: boolean }) {
  const { data: session, status } = useSession();
  const pathname = usePathname() || "/";
  const role: string | undefined = (session?.user as any)?.role;
  const name = session?.user?.name || "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [navInfo, setNavInfo] = useState<{ unread: number; packageCount: number | null }>({ unread: 0, packageCount: null });

  // Unread badge + package count. Refreshes on page change, every minute,
  // when the tab regains focus, right after a thread is read, and when a
  // new message arrives.
  useEffect(() => {
    if (status !== "authenticated" || role === "ADMIN" || role === "ADMIN_2FA") return;
    let alive = true;
    const load = () =>
      fetch("/api/me/nav")
        .then((r) => r.json())
        .then((d) => alive && setNavInfo({ unread: d.unread || 0, packageCount: typeof d.packageCount === "number" ? d.packageCount : null }))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    window.addEventListener("focus", load);
    window.addEventListener("mmd:unread-changed", load);
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
      window.removeEventListener("focus", load);
      window.removeEventListener("mmd:unread-changed", load);
    };
  }, [status, role, pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setDrawerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Once the page is scrolled, the bar turns solid white (on the homepage
  // it starts see-through over the hero) and shows the quick links row.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Close menus on navigation.
  useEffect(() => {
    setMenuOpen(false);
    setDrawerOpen(false);
  }, [pathname]);

  const isHome = pathname === "/";
  const marketing = !session || role === "BUYER";
  // Quick links only on the pages where students are looking for a mentor.
  const showQuick = scrolled && marketing && (isHome || pathname.startsWith("/mentors") || pathname === "/senior-team");
  // Mentors with no hourly rate / offers yet see "Set your rate".
  const userId: string | undefined = (session?.user as any)?.id;
  const right = (role ? RIGHT_LINKS[role] || [] : []).map((l) =>
    l.href === "/dashboard/packages" && navInfo.packageCount === 0 ? { label: "Set your rate", href: "/dashboard/packages#rate" } : l
  );
  // Mentors: a simple bar (logo, View my public profile, account menu).
  const publicProfile = role === "SELLER" && userId ? previewHref(userId) : null;
  const badge = (href: string) =>
    href === "/messages" && navInfo.unread > 0 ? (
      <span className="count-badge" aria-label={`${navInfo.unread} unread`}>{navInfo.unread > 99 ? "99+" : navInfo.unread}</span>
    ) : null;
  const menu = role ? MENU[role] || [] : [];
  const mainLinks = (!session ? LOGGED_OUT_LINKS : role === "BUYER" ? STUDENT_LINKS : role === "SELLER" ? [] : OTHER_LINKS).filter((l) => !l.reviews || showReviews);
  const mainActive = (href: string): "page" | undefined => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")) ? "page" : undefined;
  const active = (href: string): "page" | undefined => (href === pathname || (href !== "/" && pathname.startsWith(href) && href !== "/dashboard") || (href === "/dashboard" && pathname === "/dashboard") ? "page" : undefined);

  return (
    <header className={`nav ${isHome ? "nav-home" : ""} ${scrolled ? "nav-scrolled" : ""}`}>
      <div className="nav-inner">
        <Logo />
        <nav aria-label="Main" className="nav-links">
          {mainLinks.map((l) => (
            <Link key={l.href} href={l.href} aria-current={mainActive(l.href)} className={l.midHide ? "nav-mid-hide" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="nav-right">
          {right.map((l) => (
            <Link key={l.href} href={l.href} className="hide-tablet" aria-current={active(l.href)} style={{ fontWeight: active(l.href) ? 600 : 400, color: active(l.href) ? "var(--primary)" : undefined, display: "inline-flex", alignItems: "center" }}>
              {l.label}
              {badge(l.href)}
            </Link>
          ))}

          {publicProfile && (
            <Link href={publicProfile} className="nav-pill hide-tablet">
              View my public profile
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </Link>
          )}

          {status !== "loading" && !session && (
            <>
              <Link href="/login" className="hide-tablet">Log in</Link>
              <Link href="/signup" className="btn btn-primary hide-tablet" style={{ padding: "14px 26px", fontSize: 16 }}>
                Get started
              </Link>
            </>
          )}

          {session && (
            <div ref={menuRef} style={{ position: "relative" }} className="hide-tablet">
              <button className="acct-btn" aria-label="Account menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
                <span className="avatar" style={{ background: role === "SELLER" ? "var(--pink-soft)" : "var(--tint-2)" }}>{initials(name)}</span>
                <Chevron />
              </button>
              {menuOpen && (
                <div className="acct-menu">
                  <div className="acct-menu-head">
                    <b style={{ fontSize: 16 }}>{name}</b>
                    <span className="text-secondary" style={{ fontSize: 14 }}>{ROLE_LABEL[role || ""] || ""}</span>
                  </div>
                  {menu.map((m) => (
                    <Link key={m.href + m.label} href={m.href} style={{ display: "flex", alignItems: "center" }}>{m.label}{badge(m.href)}</Link>
                  ))}
                  <button onClick={() => logOut()} className="logout-item">
                    <LogoutIcon />
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}

          <button className="nav-burger" aria-label="Open menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      {showQuick && (
        <nav aria-label="Quick links" className="nav-quick">
          <div className="nav-quick-inner">
            {MENTOR_QUICK_LINKS.map((q) => (
              <Link key={q.label} href={quickLinkHref(q)}>{q.label}</Link>
            ))}
          </div>
        </nav>
      )}

      {drawerOpen && (
        <div className="nav-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="between" style={{ marginBottom: 12 }}>
            <Logo />
            <button className="nav-burger" aria-label="Close menu" onClick={() => setDrawerOpen(false)} style={{ display: "inline-flex" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {mainLinks.map((l) => (
            <Link key={l.href} href={l.href} aria-current={mainActive(l.href)}>{l.label}</Link>
          ))}
          {publicProfile && <Link href={publicProfile}>View my public profile</Link>}
          {right.map((l) => <Link key={"r" + l.href} href={l.href} style={{ display: "flex", alignItems: "center" }}>{l.label}{badge(l.href)}</Link>)}
          {menu
            .filter((m) => !right.some((r) => r.href === m.href))
            .map((m) => <Link key={"m" + m.href + m.label} href={m.href}>{m.label}</Link>)}
          {!session ? (
            <div className="stack" style={{ marginTop: 24 }}>
              <Link href="/signup" className="btn btn-primary btn-lg" style={{ borderBottom: "none" }}>Get started</Link>
              <Link href="/login" className="btn btn-lg" style={{ borderBottom: "1px solid var(--line)" }}>Log in</Link>
            </div>
          ) : (
            <button className="drawer-link" onClick={() => logOut()} style={{ color: "var(--danger)", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
              <LogoutIcon />
              Log out
            </button>
          )}
        </div>
      )}
    </header>
  );
}
