import { NextResponse } from "next/server";
import { csvBody, csvResponse } from "@/lib/csv";
import { APPLICATION_STATUS_LABEL, contactTopicLabel, leadStatusLabel } from "@/lib/leads";
import { leadsAdmin, listLeads, parseKind } from "@/lib/leadQueries";
import { labelFor, SERVICES } from "@/lib/options";
import { siteUrl } from "@/lib/siteUrl";

// Admin -> Leads -> Download CSV, one file per kind of lead.
export async function GET(req: Request) {
  const kind = parseKind(new URL(req.url).searchParams.get("kind"));
  if (!kind) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  const admin = await leadsAdmin(kind);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rows = (await listLeads(kind)) as any[];
  const notes = (r: any) => r.notes.map((n: any) => `${new Date(n.createdAt).toISOString().slice(0, 16).replace("T", " ")} ${n.author?.name || "Admin"}: ${n.body}`).join(" | ");
  const day = new Date().toISOString().slice(0, 10);

  if (kind === "APPLICATION") {
    return csvResponse(
      `mentor-applications-${day}.csv`,
      csvBody(
        ["Applied", "Name", "Email", "Phone", "Medical school", "Residency", "Status", "Decided", "Assigned to", "About", "Resume", "Notes"],
        rows.map((r) => [r.createdAt, r.name, r.email, r.phone, r.medicalSchool, r.residency, APPLICATION_STATUS_LABEL[r.status] || r.status, r.decidedAt, r.assignedTo?.name, r.blurb, `${siteUrl()}/api/admin/applications/${r.id}/resume`, notes(r)])
      )
    );
  }
  if (kind === "CONTACT") {
    return csvResponse(
      `contact-messages-${day}.csv`,
      csvBody(
        ["Sent", "Name", "Email", "Topic", "Message", "Status", "Assigned to", "Notes"],
        rows.map((r) => [r.createdAt, r.name, r.email, contactTopicLabel(r.topic), r.message, leadStatusLabel(r.status), r.assignedTo?.name, notes(r)])
      )
    );
  }
  return csvResponse(
    `waitlist-${day}.csv`,
    csvBody(
      ["Signed up", "Email", "Needs help with", "Applying in", "Page", "Status", "Assigned to", "Emailed that mentors joined", "Notes"],
      rows.map((r) => [r.createdAt, r.email, r.service ? labelFor(SERVICES, r.service) : "", r.applyYear, r.source, leadStatusLabel(r.status), r.assignedTo?.name, r.notifiedAt, notes(r)])
    )
  );
}
