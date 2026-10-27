// Gifts from a parent (Oct 2026, ported from AdmitMD's "buy for my
// student"). Server only.
//
// A parent or guardian has no account. On /gift they give their name and
// email, their student's name and email, and either an amount of
// MentorsMD credit or one of a mentor's offers (the "Buying for your
// student?" link on a mentor's profile). They pay on a Stripe Checkout
// page as a guest; Stripe emails them its card receipt.
//
// When the payment clears (the Stripe webhook, or the parent landing back
// on their gift page, whichever is first; it only ever happens once):
//   1. The student's account is found by email, or created with no
//      password (like AdmitMD's lib/fulfill.ts).
//   2. Credit: a CreditEntry (reason GIFT, "Gift from <parent>").
//      Package: a normal Order, exactly as if the student bought it
//      (same price, same payout and fee). Buying for a student doesn't
//      need the mentor to be "unlocked" first: the student may not have an
//      account yet, and the order itself unlocks the mentor afterwards.
//      If the package can't be created any more (the mentor stopped
//      taking orders, or one of them blocked the other), the amount is
//      added as credit instead.
//   3. The student gets an email: a "Set up your account" link for a new
//      account (sets a password, date of birth and the agreements, like
//      signup), or a login link for an existing one.
//   4. The parent gets a receipt with their private gift page
//      (/gift/<token>).
// The credit or package can only be used once the student can log in and
// has passed the account gate (date of birth, legal, and for 13-17 a
// parent's consent). Buying a gift is NOT the parental consent: consent
// needs the parent's signature on the consent form, so a student under 18
// still goes through the normal consent email after setting up.
import crypto from "crypto";
import bcrypt from "bcrypt";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/siteUrl";
import { money } from "@/lib/options";
import { hoursLabel, offerMinutes, offerRate, priceFor } from "@/lib/pricing";
import { isMentorListed } from "@/lib/mentor";
import { payoutsReady } from "@/lib/stripeAccountStatus";
import { blockBetween } from "@/lib/blocks";
import { lockCredit } from "@/lib/credit";
import { fundsAvailableFor } from "@/lib/hourCheckout";
import { cleanParentInfo } from "@/lib/minors";
import { applyDobAndAgreement } from "@/lib/signupFlow";
import { ADULT_AGE, MIN_AGE, ageOn, parseDob } from "@/lib/legalKinds";
import { LIMITS, isNonEmptyString, isValidNewPassword, normalizeEmail, PASSWORD_RULE } from "@/lib/validate";
import { isValidTimeZone } from "@/lib/tz";
import { isReservedName, RESERVED_NAME_ERROR } from "@/lib/reservedNames";
import { logAdminAction } from "@/lib/adminLog";
import { reportError } from "@/lib/sentry";
import { createFlag } from "@/lib/flags";
import { sendGiftReceiptEmail, sendGiftReceivedEmail, sendOrderPaidEmail } from "@/lib/email";
import { GIFT_CLAIM_DAYS, GIFT_NOTE_MAX, parseGiftDollars } from "@/lib/giftOptions";

// Unpaid Stripe pages expire after 1 hour, like every other checkout.
const SESSION_MINUTES = 60;
const OFFER_KINDS = ["HOURLY", "BUNDLE", "SPECIALIZED"];

export class GiftError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("hex");
const isToken = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{64}$/.test(t);
const first = (name: string) => name.split(" ")[0];

export const giftPageUrl = (token: string) => `${siteUrl()}/gift/${token}`;
export const giftClaimUrl = (token: string) => `${siteUrl()}/gift/claim?token=${token}`;

// ---------- The form ----------

export type GiftForm = {
  parentName: string;
  parentEmail: string;
  studentName: string;
  studentEmail: string;
  note: string | null;
  under18: boolean;
  amountCents: number | null; // credit gifts
  gigId: string | null; // package gifts
};

// Checks the /gift form. Throws a GiftError with what to fix.
export function cleanGiftForm(body: any): GiftForm {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const parentName = str(body?.parentName);
  const studentName = str(body?.studentName);
  if (!isNonEmptyString(parentName, LIMITS.name)) throw new GiftError("Enter your name");
  if (!isNonEmptyString(studentName, LIMITS.name)) throw new GiftError("Enter your student's name");
  if (isReservedName(parentName) || isReservedName(studentName)) throw new GiftError(RESERVED_NAME_ERROR);
  const parentEmail = normalizeEmail(body?.parentEmail);
  if (!parentEmail) throw new GiftError("Enter your email address");
  const studentEmail = normalizeEmail(body?.studentEmail);
  if (!studentEmail) throw new GiftError("Enter your student's email address");
  if (parentEmail === studentEmail) throw new GiftError("Use your student's own email address, not yours: it's where they'll log in.");
  const note = str(body?.note).slice(0, GIFT_NOTE_MAX) || null;
  if (typeof body?.under18 !== "boolean") throw new GiftError("Tell us whether your student is under 18");
  const gigId = typeof body?.gigId === "string" && body.gigId ? body.gigId.slice(0, 64) : null;
  const amountCents = gigId ? null : parseGiftDollars(body?.amount);
  if (!gigId && amountCents === null) throw new GiftError("Pick an amount between $50 and $5,000 (whole dollars)");
  return { parentName, parentEmail, studentName, studentEmail, note, under18: body.under18, amountCents, gigId };
}

// The student's account, if they have one (any capitalisation).
function findStudent(email: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  return tx.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, role: true, removedAt: true, removedByAdmin: true, profileStatus: true, safetyHoldAt: true, minorStatus: true, passwordHash: true },
  });
}
type StudentRow = NonNullable<Awaited<ReturnType<typeof findStudent>>>;

// Why this account can't receive a gift, or null.
function studentProblem(u: StudentRow): string | null {
  if (u.role !== "BUYER") return "That email belongs to a mentor or team account. Use your student's own email address.";
  if (u.removedAt || u.removedByAdmin || u.profileStatus === "REMOVED" || u.safetyHoldAt) return "We can't send a gift to that account. Contact us if you think this is a mistake.";
  return null;
}

// The offer a parent is buying, with its price now. Throws when it can't
// be bought for this student.
async function giftableOffer(gigId: string, student: StudentRow | null, under18: boolean) {
  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig || !gig.active || !gig.kind || !OFFER_KINDS.includes(gig.kind)) throw new GiftError("That package isn't available any more.", 404);
  const mentor = await prisma.user.findUnique({ where: { id: gig.sellerId } });
  if (!mentor || mentor.role !== "SELLER" || !isMentorListed(mentor)) throw new GiftError("This mentor isn't taking new orders right now.");
  if (!(await payoutsReady(mentor.stripeAccountId))) throw new GiftError("This mentor isn't taking new orders right now.");
  if ((under18 || !!student?.minorStatus) && !mentor.acceptsMinors) throw new GiftError("This mentor works with students 18 and over. You can give MentorsMD credit instead, to use with any mentor.");
  if (student) {
    const b = await blockBetween(student.id, mentor.id);
    if (b.iBlocked || b.theyBlocked) throw new GiftError("This package can't be bought for this student. You can give MentorsMD credit instead.");
  }
  const rateCents = offerRate(gig, mentor.hourlyRateCents);
  const minutes = offerMinutes(gig);
  if (!rateCents || !minutes) throw new GiftError("This package isn't available to buy right now.");
  const title = gig.kind === "HOURLY" ? `Hourly: 1 hour with ${first(mentor.name)}` : gig.title;
  return { gig, mentor, rateCents, minutes, title, priceCents: priceFor(minutes, rateCents) };
}

// ---------- Checkout ----------

// Creates the gift and its Stripe page; returns the page's address.
export async function startGiftCheckout(form: GiftForm, ip: string | null) {
  const student = await findStudent(form.studentEmail);
  const problem = student && studentProblem(student);
  if (problem) throw new GiftError(problem, 403);

  const offer = form.gigId ? await giftableOffer(form.gigId, student, form.under18) : null;
  const amountCents = offer ? offer.priceCents : form.amountCents!;
  if (!amountCents || amountCents < 50) throw new GiftError("This isn't available to buy right now.");

  const token = newToken();
  const gift = await prisma.gift.create({
    data: {
      kind: offer ? "PACKAGE" : "CREDIT",
      amountCents,
      parentName: form.parentName,
      parentEmail: form.parentEmail,
      studentName: form.studentName,
      studentEmail: form.studentEmail,
      note: form.note,
      studentUnder18: form.under18,
      gigId: offer?.gig.id ?? null,
      mentorId: offer?.mentor.id ?? null,
      minutes: offer?.minutes ?? null,
      rateCents: offer?.rateCents ?? null,
      packageTitle: offer?.title ?? null,
      viewTokenHash: hash(token),
      ip: ip?.slice(0, 64) ?? null,
    },
  });

  const name = offer ? `Gift for ${form.studentName}: ${offer.title}` : `MentorsMD credit for ${form.studentName}`;
  const description = offer
    ? `${hoursLabel(offer.minutes)} with ${offer.mentor.name} at ${money(offer.rateCents)}/hr, for ${form.studentName} (${form.studentEmail}).`
    : `${money(amountCents)} of MentorsMD credit for ${form.studentName} (${form.studentEmail}). Credit never expires and can be used with any mentor.`;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price_data: { currency: "usd", product_data: { name: name.slice(0, 250), description: description.slice(0, 500) }, unit_amount: amountCents }, quantity: 1 }],
      // giftToken: the webhook needs it to email the parent their page
      // link (only its hash is stored). The parent also lands on that page.
      metadata: { giftId: gift.id, giftToken: token },
      // Stripe emails the parent its own card receipt.
      payment_intent_data: { metadata: { giftId: gift.id }, receipt_email: form.parentEmail },
      customer_email: form.parentEmail,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
      success_url: `${giftPageUrl(token)}?paid=1`,
      cancel_url: `${siteUrl()}/gift?cancelled=1${offer ? `&offer=${encodeURIComponent(offer.gig.id)}` : ""}`,
    });
    await prisma.gift.update({ where: { id: gift.id }, data: { stripeSessionId: session.id } });
    return { url: session.url! };
  } catch (err) {
    await prisma.gift.updateMany({ where: { id: gift.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    console.error("Stripe gift checkout failed", err);
    throw new GiftError("Couldn't start checkout. Please try again.", 502);
  }
}

// The Stripe page expired: nothing was paid, so the gift is just closed.
export async function cancelUnpaidGift(giftId: string) {
  await prisma.gift.updateMany({ where: { id: giftId, status: "PENDING" }, data: { status: "CANCELLED" } });
}

// ---------- Payment cleared ----------

// Gives the gift, once, however many times it's called. Everything that
// changes the database happens in one transaction, so a failure part-way
// leaves the gift unpaid and Stripe's retry does it all again.
export async function fulfilGift(giftId: string, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  const fundsAvailableAt = await fundsAvailableFor(session);
  const claimToken = newToken();
  const now = new Date();
  // A package gift's mentor must still be able to take payouts, as at a
  // normal checkout. Asked of Stripe before the transaction (it's slow);
  // if not, the gift becomes credit below.
  const before = await prisma.gift.findUnique({ where: { id: giftId }, select: { kind: true, mentorId: true } });
  let mentorPayoutsReady = false;
  if (before?.kind === "PACKAGE" && before.mentorId) {
    const m = await prisma.user.findUnique({ where: { id: before.mentorId }, select: { stripeAccountId: true } });
    mentorPayoutsReady = await payoutsReady(m?.stripeAccountId);
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const paid = await tx.gift.updateMany({
        where: { id: giftId, status: "PENDING" },
        data: { status: "PAID", paidAt: now, stripeSessionId: session.id, stripePaymentIntentId: (session.payment_intent as string) || null },
      });
      if (!paid.count) return null;
      const gift = await tx.gift.findUniqueOrThrow({ where: { id: giftId } });

      // 1. The student's account.
      let student = await findStudent(gift.studentEmail, tx);
      let isNew = false;
      if (!student) {
        const created = await tx.user.create({
          data: { email: gift.studentEmail, name: gift.studentName, role: "BUYER", signupSource: "gift", signupDetail: "Bought by a parent" },
        });
        student = (await findStudent(created.email, tx))!;
        isNew = true;
      }
      const problem = studentProblem(student);
      if (problem) {
        // Paid, but the account can't receive it (removed or paused since
        // the parent filled in the form). The team sorts it out.
        const note = `Paid ${money(gift.amountCents)}, but ${student.email} can't receive gifts: ${problem} Refund the parent in Stripe or contact them.`;
        await tx.gift.update({ where: { id: gift.id }, data: { status: "NEEDS_REVIEW", studentId: student.id, reviewNote: note } });
        return { gift, student, isNew, problem: note, orderId: null as string | null, fellBackToCredit: false, claim: false };
      }

      // 2. What they bought.
      let orderId: string | null = null;
      let creditEntryId: string | null = null;
      let fellBackToCredit = false;
      if (gift.kind === "PACKAGE" && gift.gigId && gift.mentorId && gift.minutes && gift.rateCents) {
        const [gig, mentor, blocks] = await Promise.all([
          tx.gig.findUnique({ where: { id: gift.gigId } }),
          tx.user.findUnique({ where: { id: gift.mentorId } }),
          tx.block.count({ where: { OR: [{ blockerId: student.id, blockedId: gift.mentorId }, { blockerId: gift.mentorId, blockedId: student.id }] } }),
        ]);
        // The same checks as buying it at checkout: the offer is still on,
        // the mentor is still listed (not paused, removed or on a safety
        // hold) and can be paid, nobody blocked anybody, and minors only
        // with mentors who accept them. Otherwise it becomes credit.
        const bookable =
          !!gig && !!mentor &&
          gig.active && gig.sellerId === mentor.id && !!gig.kind && OFFER_KINDS.includes(gig.kind) &&
          mentor.role === "SELLER" && !mentor.removedAt && !mentor.safetyHoldAt && isMentorListed(mentor) && mentorPayoutsReady &&
          !blocks && (mentor.acceptsMinors || !student.minorStatus);
        if (gig && mentor && bookable) {
          const conversation = await tx.conversation.upsert({
            where: { buyerId_sellerId: { buyerId: student.id, sellerId: mentor.id } },
            update: {},
            create: { buyerId: student.id, sellerId: mentor.id },
          });
          const order = await tx.order.create({
            data: {
              gigId: gig.id,
              buyerId: student.id,
              sellerId: mentor.id,
              conversationId: conversation.id,
              amount: gift.amountCents,
              status: "IN_ESCROW",
              paidAt: now,
              fundsAvailableAt,
              stripePaymentIntentId: session.id,
              kind: gig.kind,
              minutesPurchased: gift.minutes,
              rateCents: gift.rateCents,
              format: gig.format,
              packageTitle: gift.packageTitle || gig.title,
              packageDescription: gig.description,
            },
          });
          orderId = order.id;
        } else {
          fellBackToCredit = true;
        }
      }
      if (gift.kind === "CREDIT" || fellBackToCredit) {
        await lockCredit(tx, student.id);
        const entry = await tx.creditEntry.create({
          data: {
            userId: student.id,
            amountCents: gift.amountCents,
            reason: "GIFT",
            note: (fellBackToCredit ? `Gift from ${gift.parentName} (for ${gift.packageTitle}, which couldn't be booked)` : `Gift from ${gift.parentName}`).slice(0, 500),
          },
        });
        creditEntryId = entry.id;
      }

      // 3. A "Set up your account" link while the account has no way to
      // log in (no password, no Google).
      const accounts = await tx.account.count({ where: { userId: student.id } });
      const claim = !student.passwordHash && accounts === 0;
      await tx.gift.update({
        where: { id: gift.id },
        data: {
          studentId: student.id,
          orderId,
          creditEntryId,
          ...(claim ? { claimTokenHash: hash(claimToken), claimExpiresAt: new Date(now.getTime() + GIFT_CLAIM_DAYS * 86400_000) } : {}),
          ...(fellBackToCredit ? { reviewNote: "The package couldn't be created when the payment cleared, so the amount was added as MentorsMD credit." } : {}),
        },
      });
      return { gift, student, isNew, problem: null as string | null, orderId, fellBackToCredit, claim };
    },
    { timeout: 20_000 }
  );

  if (!result) {
    const g = await prisma.gift.findUnique({ where: { id: giftId }, select: { status: true } });
    if (g?.status === "CANCELLED") {
      const note = `[NEEDS MANUAL CHECK] Gift ${giftId} was paid on Stripe (session ${session.id}) after its checkout was closed. Refund the parent or add the gift by hand.`;
      console.error(note);
      await reportError(note, undefined, { giftId }, "fatal");
    }
    return;
  }

  const { gift, student, orderId } = result;
  await logAdminAction({
    adminId: null,
    action: "GIFT_PAID",
    summary: `${gift.parentName} (parent) bought ${giftLine(gift)} for ${student.name}${result.isNew ? " (new account)" : ""}${result.problem ? ": needs the team" : ""}`,
    targetType: orderId ? "ORDER" : "USER",
    targetId: orderId ?? student.id,
    targetUserId: student.id,
    details: { giftId: gift.id, amountCents: gift.amountCents, kind: gift.kind, fellBackToCredit: result.fellBackToCredit },
  });
  if (result.problem) {
    await reportError(`[NEEDS MANUAL CHECK] ${result.problem}`, undefined, { giftId: gift.id }, "fatal");
    return;
  }

  const token = session.metadata?.giftToken;
  const line = result.fellBackToCredit ? `${money(gift.amountCents)} of MentorsMD credit` : giftLine(gift);
  await sendGiftReceivedEmail(student.email, {
    studentName: student.name,
    parentName: gift.parentName,
    giftShort: gift.kind === "CREDIT" || result.fellBackToCredit ? `${money(gift.amountCents)} of credit` : "a MentorsMD package",
    giftLine: line,
    note: gift.note,
    claimUrl: result.claim ? giftClaimUrl(claimToken) : null,
    claimDays: GIFT_CLAIM_DAYS,
  }).catch((err) => console.error("Gift email to the student failed", err));
  if (isToken(token) && hash(token) === gift.viewTokenHash) {
    await sendGiftReceiptEmail(gift.parentEmail, {
      parentName: gift.parentName,
      studentName: gift.studentName,
      giftLine: line,
      amountCents: gift.amountCents,
      paidAt: new Date(),
      under18: (gift.studentUnder18 || !!student.minorStatus) && student.minorStatus !== "CONSENTED",
      giftUrl: giftPageUrl(token),
    }).catch((err) => console.error("Gift receipt to the parent failed", err));
  }
  if (orderId && gift.mentorId) {
    const mentor = await prisma.user.findUnique({ where: { id: gift.mentorId }, select: { email: true } });
    // The normal "new order" email, saying a parent bought it.
    if (mentor) await sendOrderPaidEmail(mentor.email, gift.packageTitle || "a package", `${student.name} (bought by a parent)`, `${siteUrl()}/orders/${orderId}`).catch((err) => console.error("Failed to send order-paid email:", err));
  }
}

// What was bought, in words.
export function giftLine(g: { kind: string; amountCents: number; packageTitle: string | null; minutes: number | null }) {
  if (g.kind === "CREDIT") return `${money(g.amountCents)} of MentorsMD credit`;
  return `${g.packageTitle || "A package"}${g.minutes ? ` (${hoursLabel(g.minutes)})` : ""}`;
}

// Back-up for the webhook: the parent lands on their gift page after
// paying. The session is read from Stripe itself, never from the browser.
export async function confirmGiftFromStripe(gift: { id: string; status: string; stripeSessionId: string | null }) {
  if (gift.status !== "PENDING" || !gift.stripeSessionId) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(gift.stripeSessionId);
    if (session.metadata?.giftId === gift.id && session.payment_status === "paid") await fulfilGift(gift.id, session);
  } catch (err) {
    console.error("Couldn't check the gift's Stripe page", err);
  }
}

// ---------- The parent's page ----------

export async function giftByViewToken(token: string) {
  if (!isToken(token)) return null;
  return prisma.gift.findUnique({ where: { viewTokenHash: hash(token) } });
}

// ---------- "Set up your account" (the student) ----------

// The gift behind a claim link, while it can still be used.
export async function giftByClaimToken(token: unknown) {
  if (!isToken(token)) return null;
  const gift = await prisma.gift.findUnique({ where: { claimTokenHash: hash(token) } });
  if (!gift || !gift.studentId || !gift.claimExpiresAt || gift.claimExpiresAt < new Date()) return null;
  const user = await prisma.user.findUnique({ where: { id: gift.studentId }, select: { id: true, email: true, name: true, role: true, passwordHash: true, removedByAdmin: true } });
  if (!user || user.role !== "BUYER" || user.removedByAdmin) return null;
  return { gift, user, alreadySetUp: !!user.passwordHash };
}

export type ClaimResult = { ok: true; email: string; minor: boolean; orderId: string | null } | { ok: false; under13: true } | { ok: false; error: string; status?: number };

// The student sets a password, confirms their name, gives their date of
// birth and accepts the agreements, exactly like signup. Students 13-17
// give a parent or guardian (filled in with the parent who bought the
// gift), who gets the normal consent email. Under 13: the account is
// closed (lib/signupFlow.ts) and the gift goes to the team to refund.
export async function claimGift(body: any, meta: { ip: string | null; userAgent: string | null }): Promise<ClaimResult> {
  const found = await giftByClaimToken(body?.token);
  if (!found) return { ok: false, error: "This link has expired or isn't valid. Use Forgot password on the login page with your email instead.", status: 400 };
  const { gift, user } = found;
  if (found.alreadySetUp) return { ok: false, error: "Your account is already set up. Log in with your email and password.", status: 409 };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!isNonEmptyString(name, LIMITS.name)) return { ok: false, error: "Enter your name" };
  if (isReservedName(name)) return { ok: false, error: RESERVED_NAME_ERROR };
  if (!isValidNewPassword(body.password)) return { ok: false, error: PASSWORD_RULE };
  if (body.agreed !== true) return { ok: false, error: "Please agree to the Terms of Service, Privacy Policy and Community Guidelines" };
  const dob = parseDob(body.dateOfBirth);
  if (!dob) return { ok: false, error: "Enter your date of birth" };
  const age = ageOn(dob);
  const minor = age >= MIN_AGE && age < ADULT_AGE;
  const parent = minor ? cleanParentInfo(body, user.email) : null;
  if (parent && "error" in parent) return { ok: false, error: parent.error };

  if (age < MIN_AGE) {
    // First stop any package a gift bought for them, so it can't be
    // worked on, approved or paid out to the mentor: marked refunded,
    // like an admin refund, and its future calls cancelled. The parent
    // paid by card, so the team refunds the card in Stripe.
    const paidGifts = await prisma.gift.findMany({ where: { studentId: user.id, status: "PAID" }, select: { id: true, orderId: true } });
    const orderIds = paidGifts.map((g) => g.orderId).filter((id): id is string => !!id);
    const now = new Date();
    if (orderIds.length) {
      await prisma.order.updateMany({
        where: { id: { in: orderIds }, status: { in: ["IN_ESCROW", "COMPLETED"] } },
        data: { status: "REFUNDED", refundedAt: now, markedCompleteAt: null, responseDeadline: null },
      });
      await prisma.callBooking
        .updateMany({ where: { orderId: { in: orderIds }, status: "BOOKED", startTime: { gt: now } }, data: { status: "CANCELLED", cancelledAt: now } })
        .catch((e) => console.error("Couldn't cancel calls on an under-13 gift package:", e));
    }
    await prisma.gift.updateMany({
      where: { studentId: user.id, status: "PAID" },
      data: {
        status: "NEEDS_REVIEW",
        reviewNote: `The student is under 13, so their account was closed${orderIds.length ? " and the package was stopped (marked refunded, nothing goes to the mentor)" : ""}. Refund the parent's card in Stripe.`,
        claimTokenHash: null,
      },
    });
    // Closes the account (lib/signupFlow.ts).
    const r = await applyDobAndAgreement({ ...user, name }, dob, null, "GIFT_CLAIM", meta);
    for (const orderId of orderIds) {
      await logAdminAction({ adminId: null, action: "GIFT_UNDER_13", summary: `Stopped a gift package (order ${orderId}): the student is under 13. Refund the parent in Stripe.`, targetType: "ORDER", targetId: orderId });
    }
    // Tells the team (Admin -> Flags, and an email to admins).
    await createFlag({
      kind: "MINOR",
      source: "SYSTEM",
      severity: 3,
      reason: "Gift for a student under 13: refund the parent",
      details: `${gift.parentName} (${gift.parentEmail}) paid ${money(gift.amountCents)} for ${giftLine(gift)}. The student entered a date of birth under 13, so the account was closed${orderIds.length ? " and the package was marked refunded" : ""}. Refund the parent's card in Stripe (Admin -> Orders & payouts -> Gifts).`,
      orderId: orderIds[0] ?? null,
      dedupeKey: `gift-under13:${gift.id}`,
    });
    await reportError(`[NEEDS MANUAL CHECK] A gift's student is under 13 (gift ${gift.id}); refund the parent.`, undefined, { giftId: gift.id }, "fatal");
    return r.ok ? { ok: false, error: "Something went wrong." } : { ok: false, under13: true };
  }

  // Set the password only if nobody else just did (two tabs at once).
  const passwordHash = await bcrypt.hash(body.password, 12);
  const set = await prisma.user.updateMany({
    where: { id: user.id, passwordHash: null },
    data: {
      passwordHash,
      name,
      // They opened the link we emailed to this address.
      emailVerified: new Date(),
      ...(isValidTimeZone(body.timeZone) ? { timeZone: body.timeZone } : {}),
    },
  });
  if (!set.count) return { ok: false, error: "Your account is already set up. Log in with your email and password.", status: 409 };
  const r = await applyDobAndAgreement({ ...user, name }, dob, parent && !("error" in parent) ? parent : null, "GIFT_CLAIM", meta);
  if (r.ok === false) return "error" in r ? { ok: false, error: r.error } : { ok: false, under13: true };
  // Every other gift's link for this account stops working.
  await prisma.gift.updateMany({ where: { studentId: user.id, claimTokenHash: { not: null } }, data: { claimTokenHash: null, claimedAt: new Date() } });
  await logAdminAction({ adminId: null, action: "GIFT_CLAIMED", summary: `${name} set up the account a gift was sent to`, targetType: "USER", targetId: user.id, targetUserId: user.id });
  if (minor) await flagMinorWithAdultsOnlyMentor(user.id, name);
  return { ok: true, email: user.email, minor, orderId: gift.orderId };
}

// The parent said "18 or over" (or left it to the mentor), but the student
// turned out to be 13-17 and the gift bought a package with a mentor who
// only works with adults. The package stays as it is (it's paid, and the
// student still needs a parent's consent before using it); the team
// decides what to do: Admin -> Flags, an email to admins, and a note on
// the gift.
async function flagMinorWithAdultsOnlyMentor(studentId: string, studentName: string) {
  const gifts = await prisma.gift.findMany({ where: { studentId, kind: "PACKAGE", status: "PAID", orderId: { not: null }, mentorId: { not: null } } });
  for (const g of gifts) {
    const mentor = await prisma.user.findUnique({ where: { id: g.mentorId! }, select: { name: true, acceptsMinors: true } });
    if (!mentor || mentor.acceptsMinors) continue;
    const note = `The student is under 18, but ${mentor.name} only works with students 18 and over. Decide with the mentor and the parent whether to keep the package or refund it.`;
    await prisma.gift.updateMany({ where: { id: g.id, status: "PAID" }, data: { status: "NEEDS_REVIEW", reviewNote: note } });
    await createFlag({
      kind: "MINOR",
      source: "SYSTEM",
      severity: 3,
      reason: "Gift package: student under 18 with an adults-only mentor",
      details: `${g.parentName} (${g.parentEmail}) bought ${giftLine(g)} for ${studentName}, who entered a date of birth under 18 when setting up their account. ${note}`,
      subjectUserId: studentId,
      orderId: g.orderId,
      dedupeKey: `gift-minor-mentor:${g.id}`,
    });
  }
}
