import { AdminSection } from "@/components/admin/AdminSection";

export const metadata = { title: "Disputes & Flags" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSection perm={["disputes", "flags"]}>{children}</AdminSection>;
}
