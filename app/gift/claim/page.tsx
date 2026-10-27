import Link from "next/link";
import { giftByClaimToken, giftLine } from "@/lib/gifts";
import { AuthShell } from "@/components/AuthShell";
import { ClaimForm } from "./ClaimForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your account", robots: { index: false } };

// "Set up your account" from a gift email (lib/gifts.ts): a student whose
// parent bought them a gift, and who had no account, sets a password,
// date of birth and the agreements here, like signup.
export default async function ClaimGiftPage({ searchParams }: { searchParams: { token?: string } }) {
  const found = await giftByClaimToken(searchParams.token);
  if (!found || found.alreadySetUp) {
    return (
      <AuthShell>
        <div className="stack" style={{ gap: 14 }}>
          <h1 className="page-title" style={{ fontSize: 34 }}>{found?.alreadySetUp ? "Your account is set up" : "This link isn't active"}</h1>
          <p className="text-secondary">
            {found?.alreadySetUp
              ? "Log in with your email and password to use your gift."
              : "Set-up links work for a limited time. Your gift is still in your account: use Forgot password on the login page with the email the gift was sent to."}
          </p>
          <div className="row-wrap">
            <Link href="/login" className="btn btn-primary">Log in</Link>
            {!found?.alreadySetUp && <Link href="/forgot-password" className="btn">Forgot password</Link>}
          </div>
        </div>
      </AuthShell>
    );
  }
  const { gift, user } = found;
  return (
    <AuthShell title={`A gift from ${gift.parentName.split(" ")[0]}`} body={`${gift.parentName} sent you ${giftLine(gift)}. Set up your account to use it.`}>
      <ClaimForm token={searchParams.token!} email={user.email} name={user.name} parentName={gift.parentName} parentEmail={gift.parentEmail} />
    </AuthShell>
  );
}
