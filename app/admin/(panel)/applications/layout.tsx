import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Mentor Applications" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"applications"}>{children}</AdminSection>;
}
