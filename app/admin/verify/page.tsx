import { TwoStepVerify } from "@/components/TwoStepVerify";
import { safeNext } from "@/lib/sessionRules";

export const metadata = { title: "2-step verification · Admin", robots: { index: false } };

// 2-step verification for admins (#116). Every admin login stops here
// until the code is right (or the browser was trusted for 30 days).
// The page itself is shared with mentors and students (components/TwoStepVerify.tsx).
export default function AdminVerifyPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams?.next, "/admin");
  return <TwoStepVerify next={next.startsWith("/admin") ? next : "/admin"} />;
}
