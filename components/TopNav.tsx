"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size / 2} height={size / 2} viewBox="0 0 18 18">
        <rect x="7" y="1" width="4" height="16" rx="1.5" fill="#fff" />
        <rect x="1" y="7" width="16" height="4" rx="1.5" fill="#fff" />
      </svg>
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="MentorsMD home">
      <LogoMark />
      <span>MentorsMD</span>
    </Link>
  );
}

type NavLink = { label: string; href: string };

const MARKETING: NavLink[] = [
  { label: "How we vet mentors", href: "/#vetting" },
  { label: "Reviews", href: "/#reviews" },
  { label: "Become a mentor", href: "/become-a-mentor" },
];

const RIGHT_LINKS: Record<string, NavLink[]> = {
  BUYER: [
    { label: "Messages", href: "/messages" },
    { label: "My orders", href: "/orders" },
  ],
  SELLER: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Messages", href: "/messages" },
    { label: "My packages", href: "/dashboard/packages" },
    { label: "Payouts", href: "/dashboard/payouts" },
  ],
  ADMIN: [{ label: "Admin", href: "/admin" }],
};

const MENU: Record<string, NavLink[]> = {
  BUYER: [
    { label: "Account settings", href: "/account" },
    { label: "Calendar & calls", href: "/account#calendar" },
    { label: "My orders", href: "/orders" },
    { label: "Messages", href: "/messages" },
    { label: "Contact us", href: "/contact" },
  ],
  SELLER: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Edit profile & photo", href: "/account" },
    { label: "Calendar & calls", href: "/account#calendar" },
    { label: "Pause or remove profile", href: "/account#availability" },
    { label: "Payouts", href: "/dashboard/payouts" },
    { label: "Contact us", href: "/contact" },
  ],
  ADMIN: [
    { label: "Admin", href: "/admin" },
    { label: "Account settings", href: "/account" },
  ],
};

const ROLE_LABEL: Record<string, string> = { BUYER: "Student account", SELLER: "Mentor account", ADMIN: "Admin" };

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function TopNav() {
  const { data: session, status } = useSession();
  const pathname = usePathname() || "/";
  const role: string | undefined = (session?.user as any)?.role;
  const name = session?.user?.name || "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close menus on navigation.
  useEffect(() => {
    setMenuOpen(false);
    setDrawerOpen(false);
  }, [pathname]);

  const isHome = pathname === "/";
  const marketing = !session || role === "BUYER";
  const right = role ? RIGHT_LINKS[role] || [] : [];
  const menu = role ? MENU[role] || [] : [];
  const active = (href: string): "page" | undefined => (href === pathname || (href !== "/" && pathname.startsWith(href) && href !== "/dashboard") || (href === "/dashboard" && pathname === "/dashboard") ? "page" : undefined);

  return (
    <header className={`nav ${isHome ? "nav-home" : ""}`}>
      <div className="nav-inner">
        <Logo />
        <nav aria-label="Main" className="nav-links">
          <Link href="/coaches" aria-current={pathname.startsWith("/coaches") ? "page" : undefined} className="row" style={{ gap: 6 }}>
            Browse mentors <Chevron />
          </Link>
          {marketing && MARKETING.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
        </nav>

        <div className="nav-right">
          {right.map((l) => (
            <Link key={l.href} href={l.href} className="hide-tablet" aria-current={active(l.href)} style={{ fontWeight: active(l.href) ? 600 : 400, color: active(l.href) ? "var(--primary)" : undefined }}>
              {l.label}
            </Link>
          ))}

          {status !== "loading" && !session && (
            <>
              <Link href="/login" className="hide-tablet">Log in</Link>
              <Link href="/signup/buyer" className="btn btn-primary hide-tablet" style={{ padding: "14px 26px", fontSize: 16 }}>
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
                    <Link key={m.href + m.label} href={m.href}>{m.label}</Link>
                  ))}
                  <button onClick={() => signOut({ callbackUrl: "/" })} style={{ borderTop: "1px solid var(--line)", marginTop: 6, color: "var(--muted)" }}>
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
          <Link href="/coaches">Browse mentors</Link>
          {marketing && MARKETING.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          {right.map((l) => <Link key={"r" + l.href} href={l.href}>{l.label}</Link>)}
          {menu
            .filter((m) => !right.some((r) => r.href === m.href))
            .map((m) => <Link key={"m" + m.href + m.label} href={m.href}>{m.label}</Link>)}
          {!session ? (
            <div className="stack" style={{ marginTop: 24 }}>
              <Link href="/signup/buyer" className="btn btn-primary btn-lg" style={{ borderBottom: "none" }}>Get started</Link>
              <Link href="/login" className="btn btn-lg" style={{ borderBottom: "1px solid var(--line)" }}>Log in</Link>
            </div>
          ) : (
            <button className="drawer-link" onClick={() => signOut({ callbackUrl: "/" })} style={{ color: "var(--muted)" }}>
              Log out
            </button>
          )}
        </div>
      )}
    </header>
  );
}
