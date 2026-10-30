import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Team & Roles" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"team"}>{children}</AdminSection>;
}
