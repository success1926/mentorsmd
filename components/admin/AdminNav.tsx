"use client";

// The admin sidebar is components/admin/AdminShell.tsx (items in
// lib/adminNav.ts). This guard is the old in-page check, kept as a
// fallback while the session loads.
export function AdminGuard({ status, isAdmin }: { status: string; isAdmin: boolean }) {
  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;
  return null;
}
