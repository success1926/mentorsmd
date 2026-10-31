import Link from "next/link";

export const metadata = {
  title: "Delete Your Account",
  description: "How to delete your MentorsMD account, and what is deleted and what is kept.",
};

// Public page on deleting a MentorsMD account (Oct 2026). Google Play asks
// every app for a web page like this; its address goes in the Play Console.
// The deletion itself is in Settings and in the phone app
// (components/DeleteAccount.tsx, lib/accountDeletion.ts).
export default function DeleteAccountPage({ searchParams }: { searchParams: { deleted?: string } }) {
  const done = searchParams.deleted === "1";
  return (
    <div className="page-narrow stack-lg" style={{ gap: 24 }}>
      <div className="stack-sm">
        <span className="eyebrow">MentorsMD</span>
        <h1 className="page-title" style={{ textAlign: "left" }}>Delete Your Account</h1>
      </div>

      {done && (
        <div role="status" className="alert alert-success">
          Your account has been deleted and you&apos;ve been signed out. We&apos;ve emailed a confirmation to your old address.
        </div>
      )}

      <section className="stack-sm">
        <h2 style={{ fontSize: 22 }}>How to delete it</h2>
        <ol className="text-secondary" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
          <li><b>On the website:</b> log in, open Settings (students: <Link href="/account" className="link">Your account</Link>; mentors: <Link href="/dashboard/settings" className="link">Settings</Link>) and choose <b>Delete my account</b>.</li>
          <li><b>In the MentorsMD app:</b> More → Settings → <b>Delete my account</b>.</li>
          <li><b>Can&apos;t log in?</b> Send us a request from the <Link href="/contact" className="link">contact page</Link> using the email on your account, and we&apos;ll delete it for you.</li>
        </ol>
        <span className="text-secondary">
          The account is deleted as soon as you confirm. If something is still open (an active package, a dispute, an upcoming intro call, or money waiting to be paid to a mentor), you&apos;ll be told what to finish first.
        </span>
      </section>

      <section className="stack-sm">
        <h2 style={{ fontSize: 22 }}>What&apos;s deleted</h2>
        <ul className="text-secondary" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
          <li>Your name, email address, photo and profile</li>
          <li>Your password, Google sign-in, 2-step settings and calendar connections</li>
          <li>Your logins on every browser and phone</li>
          <li>A mentor&apos;s public profile and packages</li>
          <li>Any unused MentorsMD credit (it can&apos;t be recovered)</li>
        </ul>
      </section>

      <section className="stack-sm">
        <h2 style={{ fontSize: 22 }}>What&apos;s kept</h2>
        <ul className="text-secondary" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
          <li>Orders, payments, payouts and credit history, for as long as tax and accounting law requires</li>
          <li>Records of agreements you accepted and of parent consent for students under 18</li>
          <li>Messages, files and reviews you sent, which stay with the people you sent them to, shown as from &ldquo;Deleted user&rdquo;</li>
          <li>Call recordings, until they&apos;re deleted on the usual schedule (60 days after the package closes)</li>
        </ul>
      </section>
    </div>
  );
}
