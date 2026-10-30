import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Legal" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"legal"}>{children}</AdminSection>;
}
