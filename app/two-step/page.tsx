import { TwoStepVerify } from "@/components/TwoStepVerify";
import { safeNext } from "@/lib/sessionRules";

export const metadata = { title: "2-step verification · MentorsMD", robots: { index: false } };

// The code step at login for mentors, and for students who turned 2-step
// on (admins use /admin/verify). middleware.ts sends people here, with the
// page they were going to as ?next=.
export default function TwoStepPage({ searchParams }: { searchParams: { next?: string } }) {
  return <TwoStepVerify next={safeNext(searchParams?.next, "/dashboard")} />;
}
