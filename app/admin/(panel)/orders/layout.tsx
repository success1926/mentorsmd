import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Orders & Payouts" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"orders"}>{children}</AdminSection>;
}
