import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { StudentCalendarPage } from "./StudentCalendar";

export const dynamic = "force-dynamic";

// Calendar is the student's (StudentCalendar.tsx). Mentors keep everything
// about time on Calendar & availability, admins see calls in Admin -> Calls.
export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) return null; // middleware sends logged-out visitors to /login
  if (user.role === "SELLER") redirect("/dashboard/availability");
  if (user.role === "ADMIN") redirect("/admin/calls");
  if (user.role !== "BUYER") {
    return (
      <div className="page-narrow">
        <div className="alert">Calendar is for student accounts. <Link href="/" className="link">Go home</Link></div>
      </div>
    );
  }
  return <StudentCalendarPage />;
}
