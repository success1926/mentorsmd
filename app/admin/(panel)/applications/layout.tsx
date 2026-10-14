import { AdminSection } from "@/components/admin/AdminSection";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"applications"}>{children}</AdminSection>;
}
