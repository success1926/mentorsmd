import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Leads inbox (Admin -> Leads): mentor applications (MentorApplication),
// contact-form messages and waitlist signups (both in the Lead table).
// The labels and lists here are safe for the browser (lib/leadOptions.ts
// re-exports them); this file adds the database helpers.

export * from "@/lib/leadOptions";

// Active admin team members, for the "Assigned to" dropdown.
export async function activeAdmins() {
  return prisma.user.findMany({
    where: { role: "ADMIN", adminDisabledAt: null, removedByAdmin: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// True when this id belongs to an active admin (only admins can be assigned).
export async function isActiveAdmin(id: string) {
  const n = await prisma.user.count({ where: { id, role: "ADMIN", adminDisabledAt: null, removedByAdmin: false } });
  return n > 0;
}

// ---- Waitlist "remove me" links ----
// Signed with NEXTAUTH_SECRET so nobody can remove someone else by
// guessing ids. The link opens a page with a "Remove me" button (so email
// scanners that open links don't remove anyone by themselves).
function secret() {
  return process.env.NEXTAUTH_SECRET || "mentorsmd";
}
export function waitlistRemoveSig(id: string) {
  return crypto.createHmac("sha256", secret()).update(`waitlist-remove:${id}`).digest("hex").slice(0, 40);
}
export function checkWaitlistRemoveSig(id: unknown, sig: unknown) {
  if (typeof id !== "string" || typeof sig !== "string" || !/^[a-z0-9]{10,40}$/i.test(id) || !/^[a-f0-9]{40}$/.test(sig)) return false;
  const want = Buffer.from(waitlistRemoveSig(id));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

// Pending applications + NEW contact messages and waitlist signups, for
// the sidebar badge. Never breaks the admin layout.
export async function newLeadCount(includeApplications: boolean) {
  try {
    const [leads, apps] = await Promise.all([
      prisma.lead.count({ where: { status: "NEW", kind: "CONTACT" } }),
      includeApplications ? prisma.mentorApplication.count({ where: { status: "PENDING", assignedToId: null } }) : Promise.resolve(0),
    ]);
    return leads + apps;
  } catch (err) {
    console.error("Couldn't count new leads:", err);
    return 0;
  }
}
