import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Emails" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"emails"}>{children}</AdminSection>;
}
