import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Leads" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"leads"}>{children}</AdminSection>;
}
