"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { logOut } from "@/components/TopNav";

// "Get started"-style buttons that make sense for whoever is looking:
// logged out -> the given signup/browse link; logged in -> their own home.
export function RoleCta({ href, label, className, style }: { href: string; label: string; className?: string; style?: React.CSSProperties }) {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  let target = { href, label };
  if (status === "authenticated") {
    if (role === "SELLER") target = { href: "/dashboard", label: "Go to Dashboard" };
    else if (role === "ADMIN") target = { href: "/admin", label: "Admin" };
    else target = { href: "/mentors", label: "Browse Mentors" };
  }
  return (
    <Link href={target.href} className={className} style={style}>
      {target.label}
    </Link>
  );
}

// Footer account links: signup/login when logged out, "Log out" when in.
export function FooterAccountLink({ kind }: { kind: "student" | "mentor" }) {
  const { status } = useSession();
  if (status === "authenticated") {
    if (kind === "mentor") return null;
    return (
      <button type="button" onClick={() => logOut()} className="link-btn" style={{ textDecoration: "none", textAlign: "left" }}>
        Log Out
      </button>
    );
  }
  return kind === "student" ? <Link href="/signup">Create an Account</Link> : <Link href="/login">Mentor Log In</Link>;
}
