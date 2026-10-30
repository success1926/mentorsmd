import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Analytics" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"analytics"}>{children}</AdminSection>;
}
