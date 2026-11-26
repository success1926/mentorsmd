import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Confirm your email" };

// Where the "Confirm your email" link lands (via /api/email/verify).
export default function VerifyEmailPage({ searchParams }: { searchParams: { status?: string } }) {
  const ok = searchParams?.status === "ok";
  return (
    <AuthShell>
      <div className="stack">
        <h1 className="auth-title">{ok ? "Email confirmed" : "That link didn't work"}</h1>
        <p className="text-secondary">
          {ok
            ? "Thanks! You can now message mentors."
            : "The link may have expired (links last 48 hours) or already been used. Log in and try sending a message: you'll see a button to get a new link."}
        </p>
        <div className="row-wrap">
          <Link href={ok ? "/messages" : "/login"} className="btn btn-primary">{ok ? "Go to messages" : "Log in"}</Link>
          <Link href="/mentors" className="btn">Browse mentors</Link>
        </div>
      </div>
    </AuthShell>
  );
}
