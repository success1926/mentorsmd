import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/adminPermissions";
import { activeAdmins } from "@/lib/leads";
import { leadsAdmin, listLeads, parseKind } from "@/lib/leadQueries";

// Admin -> Leads: one kind of lead (?kind=APPLICATION|CONTACT|WAITLIST),
// newest first, with assignee and notes; plus the team list for the
// "Assigned to" dropdown and the New count for each tab.
export async function GET(req: Request) {
  const kind = parseKind(new URL(req.url).searchParams.get("kind"));
  if (!kind) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  const admin = await leadsAdmin(kind);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const seeApps = can(admin, "applications");
  const [rows, admins, newContact, newWaitlist, newApps, toNotify] = await Promise.all([
    listLeads(kind),
    activeAdmins(),
    prisma.lead.count({ where: { kind: "CONTACT", status: "NEW" } }),
    prisma.lead.count({ where: { kind: "WAITLIST", status: "NEW" } }),
    seeApps ? prisma.mentorApplication.count({ where: { status: "PENDING", assignedToId: null } }) : Promise.resolve(0),
    prisma.lead.count({ where: { kind: "WAITLIST", notifiedAt: null } }),
  ]);
  return NextResponse.json({
    rows,
    admins,
    me: admin.id,
    canApplications: seeApps,
    counts: { APPLICATION: newApps, CONTACT: newContact, WAITLIST: newWaitlist },
    toNotify,
  });
}
