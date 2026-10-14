import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/adminTeam";
import { ApplicationsPage } from "./ApplicationsPage";

export const dynamic = "force-dynamic";

// Mentor applications now live in Admin -> Leads (Applications tab), with
// assignees and notes. Anyone whose role includes Leads goes there; a role
// with only "Mentor applications" keeps this page.
export default async function AdminApplicationsPage() {
  if (await currentAdmin("leads")) redirect("/admin/leads?tab=APPLICATION");
  return <ApplicationsPage />;
}
