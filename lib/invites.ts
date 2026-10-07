import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendSellerInviteEmail } from "@/lib/email";

// Creates a mentor invite and emails the one-click link. Used by
// Admin -> Invite a mentor and by the one-click Invite on an application.
// `email` must already be normalized (lib/validate.ts normalizeEmail).
export async function createAndSendInvite(email: string, adminId: string) {
  const code = crypto.randomBytes(8).toString("hex").toUpperCase(); // 16 chars - not guessable
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  const invite = await prisma.invite.create({
    data: { code, email, expiresAt, createdById: adminId },
  });

  const inviteUrl = `${process.env.NEXTAUTH_URL}/become-a-mentor/join?code=${code}&email=${encodeURIComponent(email)}`;

  try {
    await sendSellerInviteEmail(email, inviteUrl);
  } catch (err) {
    console.error("Failed to send invite email:", err);
    // The invite still exists even if the email failed to send - the
    // admin can resend it rather than losing the whole invite over a
    // transient email error. Pass the real reason back so the admin sees
    // it (e.g. "domain is not verified") instead of a silent failure.
    const reason = err instanceof Error ? err.message : String(err);
    return { invite, emailSent: false as const, warning: `Invite created but the email failed to send: ${reason}` };
  }
  return { invite, emailSent: true as const };
}
