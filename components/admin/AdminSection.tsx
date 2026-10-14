import { currentAdmin } from "@/lib/adminTeam";
import type { PermissionCheck } from "@/lib/adminPermissions";

// Wraps one admin area (used by each section's layout.tsx): shows it only
// if the logged-in admin's role includes that area. The area's APIs check
// the same permission on the server.
export async function AdminSection({ perm, children }: { perm: PermissionCheck; children: React.ReactNode }) {
  const admin = await currentAdmin(perm);
  if (!admin) {
    return (
      <div className="page">
        <div className="alert alert-blue">Your role doesn&apos;t include this part of Admin. Ask the Owner if you need it.</div>
      </div>
    );
  }
  return <>{children}</>;
}
