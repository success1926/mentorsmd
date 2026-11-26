import { AuthShell } from "@/components/AuthShell";
import { RemoveFromWaitlist } from "./RemoveFromWaitlist";

export const metadata = { title: "Leave the waitlist", robots: { index: false } };

// Opened from the "Remove me from the waitlist" link in the waitlist
// email. Nothing happens until they press the button, so email scanners
// that open links can't remove anyone.
export default function WaitlistRemovePage({ searchParams }: { searchParams: { id?: string; sig?: string } }) {
  return (
    <AuthShell>
      <div className="stack">
        <div className="stack-sm">
          <h1 className="auth-title">Leave the waitlist</h1>
          <p className="text-secondary">We&apos;ll delete your email from the MentorsMD waitlist and won&apos;t email you about mentors joining again.</p>
        </div>
        <RemoveFromWaitlist id={searchParams?.id || ""} sig={searchParams?.sig || ""} />
      </div>
    </AuthShell>
  );
}
