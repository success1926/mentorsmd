import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MentorShell } from "@/components/MentorShell";
import { StudentShell } from "@/components/StudentShell";

// Server wrapper for layouts that mentors and students share (/dashboard,
// /messages, /orders, /calendar, and the student-only /account, /credit,
// /receipts): mentors get the mentor area sidebar
// (components/MentorShell.tsx), students the student area sidebar
// (components/StudentShell.tsx, student area v2), everyone else (admins,
// logged out) sees the page as before.
export async function MentorArea({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role === "SELLER") return <MentorShell>{children}</MentorShell>;
  if (role === "BUYER") return <StudentShell>{children}</StudentShell>;
  return <>{children}</>;
}
