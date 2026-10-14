import { prisma } from "@/lib/prisma";
import { currentAdmin, type CurrentAdmin } from "@/lib/adminTeam";
import { can } from "@/lib/adminPermissions";
import { applicationStage, LEAD_KINDS, type LeadKind } from "@/lib/leadOptions";

// Server helpers for the Admin -> Leads APIs.

export const parseKind = (v: unknown): LeadKind | null => (LEAD_KINDS as readonly string[]).includes(v as string) ? (v as LeadKind) : null;

// The admin, if they may work with this kind of lead: "leads" for every
// kind, plus "applications" for mentor applications.
export async function leadsAdmin(kind?: LeadKind | null): Promise<CurrentAdmin | null> {
  const admin = await currentAdmin("leads");
  if (!admin) return null;
  if (kind === "APPLICATION" && !can(admin, "applications")) return null;
  return admin;
}

const noteSelect = { id: true, body: true, createdAt: true, author: { select: { id: true, name: true } } } as const;
const assigneeSelect = { id: true, name: true } as const;
const MAX_ROWS = 500;

export async function listLeads(kind: LeadKind) {
  if (kind === "APPLICATION") {
    const apps = await prisma.mentorApplication.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      select: {
        id: true, name: true, email: true, phone: true, medicalSchool: true, residency: true, blurb: true,
        resumeUrl: true, resumeName: true, status: true, createdAt: true, decidedAt: true, assignedToId: true,
        assignedTo: { select: assigneeSelect },
        notes: { orderBy: { createdAt: "asc" }, select: noteSelect },
      },
    });
    return apps.map((a) => ({ ...a, kind, stage: applicationStage(a) }));
  }
  const leads = await prisma.lead.findMany({
    where: { kind },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: {
      id: true, email: true, name: true, topic: true, message: true, service: true, applyYear: true, source: true,
      status: true, createdAt: true, notifiedAt: true, assignedToId: true,
      assignedTo: { select: assigneeSelect },
      notes: { orderBy: { createdAt: "asc" }, select: noteSelect },
    },
  });
  return leads.map((l) => ({ ...l, kind, stage: l.status }));
}
