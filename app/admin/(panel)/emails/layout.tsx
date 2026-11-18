import { AdminSection } from "@/components/admin/AdminSection";

// A plain string here would stop the "| MentorsMD Admin" ending reaching each email's page.
export const metadata = { title: { absolute: "Emails | MentorsMD Admin", template: "%s | MentorsMD Admin" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"emails"}>{children}</AdminSection>;
}
