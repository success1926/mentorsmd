import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Under 18" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"minors"}>{children}</AdminSection>;
}
