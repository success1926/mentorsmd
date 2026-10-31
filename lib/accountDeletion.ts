import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { creditBalance } from "@/lib/credit";
import { mentorPayoutSummary } from "@/lib/payouts";
import { PUBLIC_BUCKET, isLegacyUrl, publicPathFromUrl, removeFiles } from "@/lib/storage";
import { sendAccountDeletedEmail } from "@/lib/email";

// "Delete my account" (Oct 2026), for students and mentors, on the website
// (Settings) and in the phone app. Both app stores require it.
//
// Rules (decided by the owner, Oct 30, 2026):
//   - Immediate: done the moment they confirm. No grace period.
//   - Not while something is still open: an active package, an open
//     dispute, an upcoming free intro call, or (mentors) money still
//     waiting for the monthly payout. They're told what to finish first.
//   - Unused MentorsMD credit is lost (shown with the amount first).
//   - Admins can't delete themselves here; an Owner removes them in
//     Admin -> Team.
//
// What "deleted" means: the account row stays (orders, payments, payouts,
// credit history, legal acceptances and parent consent records point at it
// and must be kept), but everything that identifies the person is wiped:
// name ("Deleted user"), email, photo, profile, password, Google link,
// 2-step settings, calendar links and Stripe link. Every browser and phone
// is signed out. Messages and reviews they wrote stay for the other person,
// shown as "Deleted user". Signing up again with the same email later
// makes a new, empty account.

export const DELETED_NAME = "Deleted user";
export const DELETED_EMAIL_DOMAIN = "deleted.mentorsmd.invalid";
export const deletedEmailFor = (userId: string) => `deleted-${userId}@${DELETED_EMAIL_DOMAIN}`;
export const isDeletedEmail = (email: string) => email.toLowerCase().endsWith(`@${DELETED_EMAIL_DOMAIN}`);

export type DeletionCheck = {
  allowed: boolean;
  // Things to finish first, in plain words (empty when allowed).
  blockers: string[];
  creditCents: number;
  hasPassword: boolean;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export async function deletionCheck(userId: string, now = new Date()): Promise<DeletionCheck | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, passwordHash: true, deletedAt: true } });
  if (!user || user.deletedAt) return null;
  const blockers: string[] = [];

  if (user.role === "ADMIN") {
    blockers.push("Admin accounts can't be deleted here. Ask a team Owner to remove you in Admin → Team & Roles.");
  }

  const side = user.role === "SELLER" ? { sellerId: userId } : { buyerId: userId };
  const [active, disputes, introCalls] = await Promise.all([
    prisma.order.count({ where: { ...side, status: "IN_ESCROW" } }),
    prisma.order.count({ where: { ...side, disputed: true, disputeResolvedAt: null, status: { in: ["IN_ESCROW", "COMPLETED"] } } }),
    prisma.callBooking.count({
      where: { kind: "INTRO", status: "BOOKED", endTime: { gt: now }, OR: [{ studentId: userId }, { mentorId: userId }] },
    }),
  ]);
  if (active) {
    blockers.push(
      user.role === "SELLER"
        ? `You have ${plural(active, "active package")}. Finish ${active === 1 ? "it" : "them"} (Mark work complete) first.`
        : `You have ${plural(active, "active package")}. ${active === 1 ? "It needs" : "They need"} to be finished and approved first.`
    );
  }
  if (disputes) blockers.push(`You have ${plural(disputes, "open dispute")}. The MentorsMD team needs to settle ${disputes === 1 ? "it" : "them"} first.`);
  if (introCalls) blockers.push(`You have ${plural(introCalls, "upcoming free intro call")}. Cancel ${introCalls === 1 ? "it" : "them"} in Calendar first.`);

  if (user.role === "SELLER") {
    const pay = await mentorPayoutSummary(userId, now);
    const waiting = pay.unpaidCents + pay.heldCents;
    if (waiting > 0) {
      blockers.push(`You have $${(waiting / 100).toFixed(2)} waiting to be paid to you. You can delete your account once the monthly payout (the 24th) has sent it.`);
    }
  }

  const creditCents = user.role === "BUYER" ? Math.max(0, await creditBalance(userId)) : 0;
  return { allowed: blockers.length === 0, blockers, creditCents, hasPassword: !!user.passwordHash };
}

// The account's own photo, if it's one we store (so it can be removed).
function avatarPath(photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  const path = isLegacyUrl(photoUrl) ? publicPathFromUrl(photoUrl) : photoUrl;
  return path && path.includes("/avatars/") ? path : null;
}

// Deletes the account. Call deletionCheck first; this checks again and
// throws if something is still open.
export async function deleteAccount(userId: string): Promise<void> {
  const check = await deletionCheck(userId);
  if (!check) throw new Error("Account not found or already deleted");
  if (!check.allowed) throw new Error(check.blockers[0]);

  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true, photoUrl: true } });
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: now,
        name: DELETED_NAME,
        email: deletedEmailFor(userId),
        emailVerified: null,
        image: null,
        passwordHash: null,
        sessionsRevokedAt: now,
        // Off the site, like a removed profile (hidden from search, no messages).
        profileStatus: "REMOVED",
        removedAt: now,
        removedReason: "Deleted their own account",
        pausedUntil: null,
        awayNote: null,
        // Profile
        credential: null, bio: null, photoUrl: null, medicalSchool: null,
        mentorStage: null, undergradSchool: null, schoolType: null, backgrounds: [], hasAdmissionsRoles: null, admissionsRoles: Prisma.DbNull,
        yearsAdvising: null, applicantsSupported: null, strongestStages: [], specialtyInterest: null, researchSummary: null,
        bestFor: [], bestForOther: null, highlights: [], knownFor: [], languages: Prisma.DbNull, funFact: null,
        hourlyRateCents: null, profileCompleteAt: null,
        studentApplyYear: null, studentStage: null, studentDegree: null, studentSchool: null, studentHelpWith: [], studentAbout: null, studentProfileAt: null,
        dateOfBirth: null,
        // Calendars, Stripe, 2-step
        calLink: null, calWebhookSecret: null, calendarToken: null, weeklyHours: Prisma.DbNull, daysOff: [],
        externalCalUrl: null, externalBusy: Prisma.DbNull, externalBusyFetchedAt: null, externalCalError: null,
        googleCalEmail: null, googleCalRefreshToken: null, googleCalConnectedAt: null,
        stripeAccountId: null,
        twoFactorMethod: null, totpSecret: null, totpLastStep: null, twoFactorEnabledAt: null, twoFactorTrustAfter: now,
      },
    }),
    prisma.gig.updateMany({ where: { sellerId: userId }, data: { active: false } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.appSession.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.adminMfaToken.deleteMany({ where: { userId } }),
    prisma.busyDate.deleteMany({ where: { userId } }),
  ]);

  // After the account is gone: remove the photo file and say goodbye. Neither
  // can undo the deletion, so failures are only logged.
  const photo = avatarPath(before.photoUrl);
  if (photo) await removeFiles(PUBLIC_BUCKET, [photo]).catch((err) => console.error("Couldn't remove a deleted account's photo:", err));
  await sendAccountDeletedEmail(before.email, before.name).catch((err) => console.error("Couldn't send the account deleted email:", err));
}
