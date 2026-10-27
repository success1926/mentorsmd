import { notFound } from "next/navigation";
import { AdminSection } from "@/components/admin/AdminSection";
import { CYCLE_RESULTS_ON } from "@/lib/cycleResults";

// Cycle results: "page not found" while NEXT_PUBLIC_CYCLE_RESULTS isn't 1.
export default function Layout({ children }: { children: React.ReactNode }) {
  if (!CYCLE_RESULTS_ON) notFound();
  return <AdminSection perm={"people"}>{children}</AdminSection>;
}
