import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Insights" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"insights"}>{children}</AdminSection>;
}
