import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Website" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"website"}>{children}</AdminSection>;
}
