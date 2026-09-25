"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { SearchBar } from "./SearchBar";
import { NavMenu } from "./NavMenu";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="MentorsMD home">
      <span className="logo-mark" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 18 18">
          <rect x="7" y="2" width="4" height="14" rx="1.5" fill="#fff" />
          <rect x="2" y="7" width="14" height="4" rx="1.5" fill="#fff" />
        </svg>
      </span>
      <span>
        Mentors<span className="logo-md">MD</span>
      </span>
    </Link>
  );
}

export function TopNav() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  return (
    <header className="topbar">
      <div className="topbar-inner" style={{ gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NavMenu />
          <Logo />
        </div>

        <nav className="hide-mobile" style={{ display: "flex", gap: 28, fontSize: 15, fontWeight: 500 }}>
          <Link href="/coaches">Find a coach</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/founders">About</Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="hide-mobile">
            <SearchBar compact target="/coaches" />
          </span>
          <div className="topbar-links">
            {!session && <Link href="/login" className="btn" style={{ border: "none", background: "transparent" }}>Log in</Link>}
            {!session && <Link href="/signup/buyer" className="btn btn-dark">Get started</Link>}
            {session && role === "BUYER" && <Link href="/orders" className="btn">My orders</Link>}
            {session && role === "SELLER" && (
              <>
                <Link href="/dashboard" className="btn hide-mobile">My packages</Link>
                <Link href="/dashboard/payouts" className="btn hide-mobile">Payouts</Link>
                <Link href="/orders" className="btn">My orders</Link>
              </>
            )}
            {session && role === "ADMIN" && <Link href="/admin" className="btn">Admin</Link>}
            {session && (
              <button onClick={() => signOut({ callbackUrl: "/" })} className="btn hide-mobile">
                Log out
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
