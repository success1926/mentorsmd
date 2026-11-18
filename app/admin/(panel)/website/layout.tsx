import { AdminSection } from "@/components/admin/AdminSection";

// A plain string here would stop the "| MentorsMD Admin" ending reaching the page editors below.
export const metadata = { title: { absolute: "Website | MentorsMD Admin", template: "%s | MentorsMD Admin" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"website"}>{children}</AdminSection>;
}
