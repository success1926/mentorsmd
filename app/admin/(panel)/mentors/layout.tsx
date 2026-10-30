import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Mentor Invites" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={"mentors"}>{children}</AdminSection>;
}
