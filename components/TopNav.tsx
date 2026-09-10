"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { SearchBar } from "./SearchBar";
import { NavMenu } from "./NavMenu";

export function TopNav() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  return (
    <div className="topbar">
      <div className="topbar-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NavMenu />
          <Link href="/" style={{ fontWeight: 700, fontSize: 18 }}>MentorsMD</Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <SearchBar compact target="/coaches" />
          {/* The main buyer-signup call to action - sits immediately next to
              search, on the far right, on every page. Only shown when
              nobody's logged in yet; once they are, this space is used for
              their role-specific links instead (see below). */}
          {!session && (
            <Link href="/signup/buyer" className="btn" style={{ background: "#1E5631", border: "none", color: "#fff", fontWeight: 600 }}>
              Join
            </Link>
          )}
          <div className="topbar-links">
            {!session && <Link href="/login" className="btn">Log in</Link>}
            {session && role === "BUYER" && <Link href="/orders" className="btn">My orders</Link>}
            {session && role === "SELLER" && (
              <>
                <Link href="/dashboard" className="btn">My packages</Link>
                <Link href="/dashboard/payouts" className="btn">Payouts</Link>
                <Link href="/orders" className="btn">My orders</Link>
              </>
            )}
            {session && role === "ADMIN" && <Link href="/admin" className="btn">Admin</Link>}
            {session && (
              <button onClick={() => signOut({ callbackUrl: "/" })} className="btn">
                Log out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
