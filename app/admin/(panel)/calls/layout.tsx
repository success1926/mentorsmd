import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Calls & Recordings" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"calls"}>{children}</AdminSection>;
}
