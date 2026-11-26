import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MyPackages } from "./MyPackages";

export const dynamic = "force-dynamic";

// My packages (/orders) is the student's list. Mentors keep their packages
// on Students & packages, admins in Admin -> Orders & payouts; each package
// page (/orders/[id]) is shared by all three.
export default async function OrdersPage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) return null; // middleware sends logged-out visitors to /login
  if (user.role === "SELLER") redirect("/dashboard/students");
  if (user.role === "ADMIN") redirect("/admin/orders");
  // Old links (/orders?id=…) open the package page.
  if (searchParams.id) redirect(`/orders/${encodeURIComponent(searchParams.id)}`);
  if (user.role !== "BUYER") {
    return (
      <div className="page-narrow">
        <div className="alert">My packages is for student accounts. <Link href="/" className="link">Go home</Link></div>
      </div>
    );
  }
  return <MyPackages />;
}
