import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MentorShell } from "@/components/MentorShell";

// Server wrapper for layouts that mentors and students share (/dashboard,
// /messages, /orders, /calendar): mentors get the mentor area sidebar
// (components/MentorShell.tsx), everyone else sees the page as before.
export async function MentorArea({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "SELLER") return <>{children}</>;
  return <MentorShell>{children}</MentorShell>;
}
