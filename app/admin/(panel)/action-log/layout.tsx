import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Action Log" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"actionlog"}>{children}</AdminSection>;
}
