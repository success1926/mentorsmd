import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  SITE_URL,
  sendMinorStatusEmail,
  sendParentConsentConfirmedEmail,
  sendParentConsentEmail,
  sendParentReceiptEmail,
} from "@/lib/email";
import { ADULT_AGE, ageOn } from "@/lib/legalKinds";
import { currentVersions, recordAcceptances } from "@/lib/legal";
import { logAdminAction } from "@/lib/adminLog";
import { createFlag } from "@/lib/flags";

// Students aged 13-17 (#106-#113).
//
//  - At signup they give a parent or guardian's name, email and phone.
//    The account is PENDING (can't message or book) until the parent
//    consents on /consent/<token>.
//  - The parent's link expires 7 days after it was first sent. Reminders
//    go out on day 2 and day 5 (each with a fresh link, same expiry).
//  - After consenting, the parent gets a receipt for every order and a
//    private page (/parent/<token>) with order and call history, where
//    they can also withdraw consent.
//  - On the 18th birthday the account converts to a regular one.

export const CONSENT_LINK_DAYS = 7;
const REMINDER_EVERY_DAYS = 2.5; // day ~2.5 and ~5
const MAX_REMINDERS = 2;

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("hex");

export const consentUrl = (token: string) => `${SITE_URL}/consent/${token}`;
export const parentUrl = (viewToken: string) => `${SITE_URL}/parent/${viewToken}`;

export type ParentInfo = { name: string; email: string; phone: string };

// Checks the parent fields from a form. Returns an error message or the clean values.
export function cleanParentInfo(body: any, studentEmail?: string): { error: string } | ParentInfo {
  const name = typeof body?.parentName === "string" ? body.parentName.trim() : "";
  const email = typeof body?.parentEmail === "string" ? body.parentEmail.trim().toLowerCase() : "";
  const phone = typeof body?.parentPhone === "string" ? body.parentPhone.trim() : "";
  if (!name || name.length > 100) return { error: "Enter your parent or guardian's full name" };
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter your parent or guardian's email address" };
  if (studentEmail && email === studentEmail.toLowerCase()) return { error: "Your parent or guardian's email must be different from yours" };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15 || phone.length > 30) return { error: "Enter your parent or guardian's phone number" };
  return { name, email, phone };
}

// A new consent request (replacing any earlier pending one) + the email.
export async function startParentConsent(student: { id: string; name: string; email: string }, parent: ParentInfo) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + CONSENT_LINK_DAYS * 86400_000);
  await prisma.parentConsent.updateMany({ where: { userId: student.id, status: { in: ["PENDING", "EXPIRED"] } }, data: { status: "REPLACED" } });
  const consent = await prisma.parentConsent.create({
    data: {
      userId: student.id,
      parentName: parent.name.slice(0, 100),
      parentEmail: parent.email,
      parentPhone: parent.phone.slice(0, 30),
      tokenHash: hash(token),
      expiresAt,
      lastSentAt: new Date(),
    },
  });
  await prisma.user.update({ where: { id: student.id }, data: { minorStatus: "PENDING" } });
  try {
    await sendParentConsentEmail(parent.email, parent.name, student.name, consentUrl(token), expiresAt);
    return { consent, emailSent: true };
  } catch (err) {
    console.error("Couldn't send the parent consent email:", err);
    return { consent, emailSent: false };
  }
}

// Sends the pending request again (fresh link, same expiry). If it has
// expired, starts a new 7-day request with the same parent details.
export async function resendParentConsent(student: { id: string; name: string; email: string }, reminder = false) {
  const latest = await prisma.parentConsent.findFirst({ where: { userId: student.id }, orderBy: { createdAt: "desc" } });
  if (!latest) return { error: "No parent or guardian on file yet." };
  if (latest.status === "CONSENTED") return { error: "Your parent or guardian has already consented." };
  if (latest.status !== "PENDING" || latest.expiresAt < new Date()) {
    const r = await startParentConsent(student, { name: latest.parentName, email: latest.parentEmail, phone: latest.parentPhone });
    return { ok: true, emailSent: r.emailSent };
  }
  const token = newToken();
  await prisma.parentConsent.update({
    where: { id: latest.id },
    data: { tokenHash: hash(token), lastSentAt: new Date(), ...(reminder ? { remindersSent: { increment: 1 } } : {}) },
  });
  try {
    await sendParentConsentEmail(latest.parentEmail, latest.parentName, student.name, consentUrl(token), latest.expiresAt, reminder);
    return { ok: true, emailSent: true };
  } catch (err) {
    console.error("Couldn't send the parent consent email:", err);
    return { ok: true, emailSent: false };
  }
}

// The consent request behind a link from the email (any status).
export async function consentByToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return prisma.parentConsent.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { select: { id: true, name: true, email: true, dateOfBirth: true, minorStatus: true } } },
  });
}

// The parent signs: typed full name = e-signature. Records the consent
// with time, IP, browser and the versions of the Terms and the form.
export async function giveConsent(token: string, signatureName: string, meta: { ip: string | null; userAgent: string | null }) {
  const consent = await consentByToken(token);
  if (!consent || consent.status !== "PENDING") return { error: "This link isn't valid any more. Ask your student to send a new one." };
  if (consent.expiresAt < new Date()) return { error: "This link has expired. Ask your student to send a new one from their account." };
  if (!consent.user.minorStatus) return { error: "This student's account no longer needs consent." };
  const versions = await currentVersions();
  const viewToken = newToken();
  const claim = await prisma.parentConsent.updateMany({
    where: { id: consent.id, status: "PENDING" },
    data: {
      status: "CONSENTED",
      consentedAt: new Date(),
      signatureName: signatureName.slice(0, 200),
      ip: meta.ip,
      userAgent: meta.userAgent,
      termsVersion: versions.TERMS,
      consentFormVersion: versions.PARENTAL_CONSENT,
      viewToken,
    },
  });
  if (claim.count === 0) return { error: "This link was already used." };
  await prisma.user.update({ where: { id: consent.userId }, data: { minorStatus: "CONSENTED" } });
  // Also in the acceptance records (Admin -> Legal), signed by the parent.
  await recordAcceptances({ id: consent.userId, email: consent.parentEmail }, ["PARENTAL_CONSENT", "TERMS"], "PARENT_CONSENT", meta, signatureName).catch((err) =>
    console.error("Couldn't record the parent's acceptance:", err)
  );
  await logAdminAction({
    adminId: null,
    action: "MINOR_CONSENT_GIVEN",
    summary: `${consent.parentName} consented for ${consent.user.name} (signed "${signatureName.slice(0, 80)}")`,
    targetType: "USER",
    targetId: consent.userId,
    targetUserId: consent.userId,
  });
  await sendParentConsentConfirmedEmail(consent.parentEmail, consent.parentName, consent.user.name, parentUrl(viewToken)).catch((err) =>
    console.error("Couldn't send the consent confirmation:", err)
  );
  await sendMinorStatusEmail(consent.user.email, consent.user.name, "CONSENTED").catch(() => {});
  return { ok: true };
}

export async function declineConsent(token: string) {
  const consent = await consentByToken(token);
  if (!consent || consent.status !== "PENDING") return { error: "This link isn't valid any more." };
  await prisma.parentConsent.update({ where: { id: consent.id }, data: { status: "DECLINED", withdrawnAt: new Date() } });
  if (consent.user.minorStatus) await prisma.user.update({ where: { id: consent.userId }, data: { minorStatus: "WITHDRAWN" } });
  await logAdminAction({
    adminId: null,
    action: "MINOR_CONSENT_DECLINED",
    summary: `${consent.parentName} declined consent for ${consent.user.name}`,
    targetType: "USER",
    targetId: consent.userId,
    targetUserId: consent.userId,
  });
  await sendMinorStatusEmail(consent.user.email, consent.user.name, "DECLINED").catch(() => {});
  return { ok: true };
}

// The parent's private page link.
export async function consentByViewToken(viewToken: string) {
  if (!/^[a-f0-9]{64}$/.test(viewToken)) return null;
  const consent = await prisma.parentConsent.findUnique({
    where: { viewToken },
    include: { user: { select: { id: true, name: true, email: true, minorStatus: true } } },
  });
  if (!consent || consent.status !== "CONSENTED" || !consent.user.minorStatus) return null;
  return consent;
}

// The parent withdraws consent: the account is paused again, and an admin
// is alerted to sort out any open orders.
export async function withdrawConsent(viewToken: string) {
  const consent = await consentByViewToken(viewToken);
  if (!consent) return { error: "This link isn't valid any more." };
  await prisma.parentConsent.update({ where: { id: consent.id }, data: { status: "WITHDRAWN", withdrawnAt: new Date(), viewToken: null } });
  await prisma.user.update({ where: { id: consent.userId }, data: { minorStatus: "WITHDRAWN" } });
  const openOrders = await prisma.order.count({ where: { buyerId: consent.userId, status: { in: ["IN_ESCROW", "COMPLETED"] } } });
  await logAdminAction({
    adminId: null,
    action: "MINOR_CONSENT_WITHDRAWN",
    summary: `${consent.parentName} withdrew consent for ${consent.user.name}${openOrders ? ` (${openOrders} open order${openOrders === 1 ? "" : "s"})` : ""}`,
    targetType: "USER",
    targetId: consent.userId,
    targetUserId: consent.userId,
  });
  await createFlag({
    kind: "MINOR",
    source: "SYSTEM",
    severity: openOrders ? 3 : 2,
    reason: "Parent withdrew consent for a student under 18",
    details: `${consent.parentName} (${consent.parentEmail}, ${consent.parentPhone}) withdrew consent for ${consent.user.name}. The account is paused.${
      openOrders ? ` They have ${openOrders} open order${openOrders === 1 ? "" : "s"}: open each one to refund or release it, and contact the parent.` : ""
    }`,
    subjectUserId: consent.userId,
  });
  await sendMinorStatusEmail(consent.user.email, consent.user.name, "WITHDRAWN").catch(() => {});
  return { ok: true };
}

// The parent's receipt for a newly paid order (#109).
export async function sendParentReceipt(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { buyer: { select: { id: true, name: true, minorStatus: true } }, seller: { select: { name: true } }, gig: { select: { title: true } } },
  });
  if (!order || order.buyer.minorStatus !== "CONSENTED") return;
  const consent = await prisma.parentConsent.findFirst({ where: { userId: order.buyer.id, status: "CONSENTED", viewToken: { not: null } }, orderBy: { consentedAt: "desc" } });
  if (!consent?.viewToken) return;
  await sendParentReceiptEmail(
    consent.parentEmail,
    consent.parentName,
    order.buyer.name,
    { gigTitle: order.gig.title, mentorName: order.seller.name, amountCents: order.amount, paidAt: new Date(), dueDate: order.dueDate },
    parentUrl(consent.viewToken)
  );
}

// Daily (from the safety cron): reminders, expired links, 18th birthdays.
export async function runDailyMinorChecks(now = new Date()) {
  let reminders = 0;
  let expired = 0;
  let adults = 0;

  // 1. Expire links past their 7 days.
  const exp = await prisma.parentConsent.updateMany({ where: { status: "PENDING", expiresAt: { lt: now } }, data: { status: "EXPIRED" } });
  expired = exp.count;

  // 2. Reminders for requests still waiting.
  const waiting = await prisma.parentConsent.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: now },
      remindersSent: { lt: MAX_REMINDERS },
      lastSentAt: { lt: new Date(now.getTime() - REMINDER_EVERY_DAYS * 86400_000 + 3600_000) },
    },
    include: { user: { select: { id: true, name: true, email: true, minorStatus: true } } },
    take: 200,
  });
  for (const c of waiting) {
    if (c.user.minorStatus !== "PENDING") continue;
    const r = await resendParentConsent(c.user, true);
    if ("ok" in r && r.emailSent) reminders++;
  }

  // 3. 18th birthdays: the account becomes a regular one.
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - ADULT_AGE, now.getUTCMonth(), now.getUTCDate()));
  const grownUp = await prisma.user.findMany({
    where: { minorStatus: { not: null }, dateOfBirth: { lte: cutoff } },
    select: { id: true, name: true, email: true, dateOfBirth: true },
    take: 500,
  });
  for (const u of grownUp) {
    if (!u.dateOfBirth || ageOn(u.dateOfBirth, now) < ADULT_AGE) continue;
    await prisma.user.update({ where: { id: u.id }, data: { minorStatus: null, becameAdultAt: now } });
    await prisma.parentConsent.updateMany({ where: { userId: u.id, viewToken: { not: null } }, data: { viewToken: null } });
    await prisma.parentConsent.updateMany({ where: { userId: u.id, status: { in: ["PENDING", "EXPIRED"] } }, data: { status: "REPLACED" } });
    await logAdminAction({ adminId: null, action: "MINOR_TURNED_18", summary: `${u.name} turned 18: account converted to a regular account`, targetType: "USER", targetId: u.id, targetUserId: u.id });
    await sendMinorStatusEmail(u.email, u.name, "ADULT").catch(() => {});
    adults++;
  }

  return { reminders, expired, adults };
}
