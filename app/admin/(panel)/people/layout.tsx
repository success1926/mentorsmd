import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Everyone" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"people"}>{children}</AdminSection>;
}
