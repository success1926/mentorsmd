"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function NavMenu() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Closes the dropdown if the person clicks anywhere outside of it.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const linkStyle = {
    display: "block",
    padding: "10px 14px",
    fontSize: 14,
    color: "#33413A",
    borderRadius: 6,
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn"
        aria-label="Open site menu"
        style={{ padding: "8px 12px", fontSize: 18, lineHeight: 1 }}
      >
        ☰
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "#F3F6F4",
            border: "1px solid #D8E2DC",
            borderRadius: 10,
            padding: 6,
            minWidth: 190,
            zIndex: 50,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <Link href="/" className="nav-menu-link" style={linkStyle} onClick={() => setOpen(false)}>Home</Link>
          <Link href="/coaches" className="nav-menu-link" style={linkStyle} onClick={() => setOpen(false)}>Browse coaches</Link>
          <Link href="/founders" className="nav-menu-link" style={linkStyle} onClick={() => setOpen(false)}>Founders</Link>

          {!session && (
            <>
              <div style={{ borderTop: "1px solid #D8E2DC", margin: "6px 0" }} />
              <Link href="/signup/buyer" className="nav-menu-link" style={linkStyle} onClick={() => setOpen(false)}>Join as a buyer</Link>
              <Link href="/login" className="nav-menu-link" style={linkStyle} onClick={() => setOpen(false)}>Log in</Link>
            </>
          )}

          {session && role === "BUYER" && (
            <>
              <div style={{ borderTop: "1px solid #D8E2DC", margin: "6px 0" }} />
              <Link href="/orders" className="nav-menu-link" style={linkStyle} onClick={() => setOpen(false)}>My orders</Link>
            </>
          )}

          {session && role === "SELLER" && (
            <>
              <div style={{ borderTop: "1px solid #D8E2DC", margin: "6px 0" }} />
              <Link href="/dashboard" className="nav-menu-link" style={linkStyle} onClick={() => setOpen(false)}>My packages</Link>
              <Link href="/dashboard/payouts" className="nav-menu-link" style={linkStyle} onClick={() => setOpen(false)}>Payouts</Link>
              <Link href="/orders" className="nav-menu-link" style={linkStyle} onClick={() => setOpen(false)}>My orders</Link>
            </>
          )}

          {session && role === "ADMIN" && (
            <>
              <div style={{ borderTop: "1px solid #D8E2DC", margin: "6px 0" }} />
              <Link href="/admin" className="nav-menu-link" style={linkStyle} onClick={() => setOpen(false)}>Admin</Link>
            </>
          )}

          {session && (
            <>
              <div style={{ borderTop: "1px solid #D8E2DC", margin: "6px 0" }} />
              <button
                onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
                className="nav-menu-link" style={{ ...linkStyle, width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
              >
                Log out
              </button>
            </>
          )}

          <div style={{ borderTop: "1px solid #D8E2DC", margin: "6px 0" }} />
          <Link href="/contact" className="nav-menu-link" style={linkStyle} onClick={() => setOpen(false)}>Contact us</Link>
        </div>
      )}
    </div>
  );
}
