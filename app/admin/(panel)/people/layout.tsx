import { AdminSection } from "@/components/admin/AdminSection";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"people"}>{children}</AdminSection>;
}
