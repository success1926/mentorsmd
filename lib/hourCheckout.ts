// Checkout for the hourly redesign (docs/redesign-2026-10.md sections 4
// and 6): buying an offer (hourly, hour bundle, specialized package),
// adding hours to a package (top-up), and paying for a single call
// (pay-per-call). Server only.
//
// How every checkout works:
//   1. The student's MentorsMD credit is applied first (lib/credit.ts). It's
//      taken straight away (a SPENT entry on the order or top-up), so it
//      can't be spent twice by two checkouts open at the same time.
//   2. If credit covers everything, the order / top-up is paid right here,
//      with no Stripe page.
//   3. Otherwise a Stripe Checkout page charges the rest. The money lands
//      in our Stripe balance (separate charges and transfers: mentors are
//      paid monthly). The webhook (app/api/webhooks/stripe) fulfils it,
//      once, however many times Stripe sends the event.
//   4. If the Stripe page expires or the student cancels it, the order /
//      top-up is cancelled and the credit given back (once).
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/siteUrl";
import { money } from "@/lib/options";
import { hoursLabel, offerMinutes, offerRate, priceFor } from "@/lib/pricing";
import { hoursSummary, isBlockMinutes, LOW_HOURS_MINUTES, splitCredit, TOP_UP_HOURS } from "@/lib/hours";
import { finishPhase } from "@/lib/finishing";
import { creditBalance, lockCredit, reverseCredit, spendCredit } from "@/lib/credit";
import { isMentorListed } from "@/lib/mentor";
import { gateBlockReason } from "@/lib/gate";
import { isUnlocked } from "@/lib/unlock";
import { blockBetween } from "@/lib/blocks";
import { ensureHourlyOffer } from "@/lib/offers";
import { CallError, bookCall, mentorScheduleSelect, openSlotsFor, orderForCallsInclude } from "@/lib/callBooking";
import { dayInZone, tzOrDefault } from "@/lib/tz";
import { sendCallTimeTakenEmail, sendHoursAddedEmail, sendOrderPaidEmail, sendPackagePurchasedEmail, SITE_URL } from "@/lib/email";
import { sendParentReceipt } from "@/lib/minors";
import { reportError } from "@/lib/sentry";

// Unpaid Stripe pages expire after 1 hour (Stripe's minimum is 30 minutes).
const SESSION_MINUTES = 60;

export class CheckoutError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message);
  }
}

type Buyer = { id: string; email?: string | null };
const first = (name: string) => name.split(" ")[0];

// ---------- Who can buy ----------

// The same rules as the profile's Buy buttons: a student, a listed mentor
// with payouts set up, the account gate (date of birth, legal, parental
// consent), the under-18 rule, no block, and the mentor is unlocked.
export async function assertCanBuy(studentId: string, mentorId: string) {
  const [student, mentor] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId }, select: { role: true, minorStatus: true, safetyHoldAt: true } }),
    prisma.user.findUnique({ where: { id: mentorId } }),
  ]);
  if (!student || student.role !== "BUYER") throw new CheckoutError("Only student accounts can buy", 403);
  if (!mentor || mentor.role !== "SELLER") throw new CheckoutError("That mentor doesn't exist", 404);
  if (!isMentorListed(mentor)) throw new CheckoutError("This mentor isn't taking new orders right now");
  if (!mentor.stripeAccountId) throw new CheckoutError("This mentor hasn't finished setting up payouts yet");
  if (student.safetyHoldAt) throw new CheckoutError("Your account is paused while our team reviews it.", 403);
  const gate = await gateBlockReason(studentId);
  if (gate) throw new CheckoutError(gate, 403, "ACCOUNT_GATE");
  if (student.minorStatus && !mentor.acceptsMinors) throw new CheckoutError("This mentor works with students 18 and over.", 403);
  const blocks = await blockBetween(studentId, mentorId);
  if (blocks.iBlocked || blocks.theyBlocked) throw new CheckoutError("You can't buy from this mentor.", 403);
  if (!(await isUnlocked(studentId, mentorId))) throw new CheckoutError("Message or book an intro call to unlock", 403, "LOCKED");
  return mentor;
}

// ---------- Stripe ----------

async function stripePage(opts: {
  name: string;
  description: string;
  chargeCents: number;
  creditCents: number;
  email?: string | null;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}) {
  const description = (opts.creditCents > 0 ? `MentorsMD credit applied: ${money(opts.creditCents)}. ` : "") + opts.description;
  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: opts.name.slice(0, 250), description: description.slice(0, 500) || undefined },
          unit_amount: opts.chargeCents,
        },
        quantity: 1,
      },
    ],
    metadata: opts.metadata,
    payment_intent_data: { metadata: opts.metadata },
    customer_email: opts.email || undefined,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
}

// When Stripe will let us move this payment's money (used by payouts).
export async function fundsAvailableFor(session: Stripe.Checkout.Session): Promise<Date | null> {
  try {
    if (!session.payment_intent) return null;
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, { expand: ["latest_charge.balance_transaction"] });
    const charge = pi.latest_charge as Stripe.Charge | null;
    const txn = charge?.balance_transaction as Stripe.BalanceTransaction | undefined;
    return txn?.available_on ? new Date(txn.available_on * 1000) : null;
  } catch (err) {
    console.error("Failed to look up funds availability:", err);
    return null;
  }
}

// ---------- New orders ----------

type NewOrder = {
  student: Buyer;
  mentor: { id: string; name: string };
  gigId: string;
  kind: "HOURLY" | "BUNDLE" | "SPECIALIZED" | "PAY_PER_CALL";
  minutes: number;
  rateCents: number;
  format: string | null;
  title: string;
  description: string;
  requestedCallStart?: Date | null;
};

async function createOrderCheckout(o: NewOrder): Promise<{ url: string; orderId: string }> {
  const total = priceFor(o.minutes, o.rateCents);
  if (total <= 0) throw new CheckoutError("This isn't available to buy right now");
  // One conversation per student and mentor; the order's messages live there.
  const conversation = await prisma.conversation.upsert({
    where: { buyerId_sellerId: { buyerId: o.student.id, sellerId: o.mentor.id } },
    update: {},
    create: { buyerId: o.student.id, sellerId: o.mentor.id },
  });

  const { order, chargeCents, creditCents } = await prisma.$transaction(async (tx) => {
    await lockCredit(tx, o.student.id);
    const split = splitCredit(total, await creditBalance(o.student.id, tx));
    const paidNow = split.chargeCents === 0;
    const order = await tx.order.create({
      data: {
        gigId: o.gigId,
        buyerId: o.student.id,
        sellerId: o.mentor.id,
        conversationId: conversation.id,
        amount: total,
        status: paidNow ? "IN_ESCROW" : "PENDING_PAYMENT",
        paidAt: paidNow ? new Date() : null,
        kind: o.kind,
        minutesPurchased: o.minutes,
        rateCents: o.rateCents,
        format: o.format,
        packageTitle: o.title,
        packageDescription: o.description,
        creditAppliedCents: split.creditCents,
        requestedCallStart: o.requestedCallStart ?? null,
      },
    });
    await spendCredit(tx, { userId: o.student.id, amountCents: split.creditCents, orderId: order.id, note: o.title });
    return { order, ...split };
  });

  if (chargeCents === 0) {
    await afterOrderPaid(order.id);
    return { url: `/orders/${order.id}?success=true`, orderId: order.id };
  }

  try {
    const session = await stripePage({
      name: o.title,
      description: o.description,
      chargeCents,
      creditCents,
      email: o.student.email,
      metadata: {
        orderId: order.id,
        kind: o.kind,
        // Pay-per-call: the time picked, re-checked when the payment clears.
        ...(o.requestedCallStart ? { callStart: o.requestedCallStart.toISOString(), callMinutes: String(o.minutes) } : {}),
      },
      successUrl: `${siteUrl()}/orders/${order.id}?success=true`,
      cancelUrl: `${siteUrl()}/api/checkout/cancel?orderId=${order.id}`,
    });
    await prisma.order.update({ where: { id: order.id }, data: { stripePaymentIntentId: session.id } });
    return { url: session.url!, orderId: order.id };
  } catch (err) {
    // No Stripe page: nothing can be paid, so undo the order and the credit.
    await prisma.order.updateMany({ where: { id: order.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
    await reverseCredit({ orderId: order.id }, "Checkout couldn't start");
    console.error("Stripe checkout failed", err);
    throw new CheckoutError("Couldn't start checkout. Please try again.", 502);
  }
}

// Buy an offer from the mentor's profile (Hourly, a bundle, a specialized package).
export async function startOfferCheckout(student: Buyer, gigId: string) {
  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig || !gig.active || !gig.kind || !["HOURLY", "BUNDLE", "SPECIALIZED"].includes(gig.kind)) throw new CheckoutError("Package not found", 404);
  const mentor = await assertCanBuy(student.id, gig.sellerId);
  const rateCents = offerRate(gig, mentor.hourlyRateCents);
  const minutes = offerMinutes(gig);
  if (!rateCents || !minutes) throw new CheckoutError("This isn't available to buy right now");
  const title = gig.kind === "HOURLY" ? "Hourly: 1 hour" : gig.title;
  return createOrderCheckout({
    student,
    mentor,
    gigId: gig.id,
    kind: gig.kind as NewOrder["kind"],
    minutes,
    rateCents,
    format: gig.format,
    title,
    description: gig.description,
  });
}

// A single 30- or 60-minute call at the mentor's hourly rate, when the
// student has no hours left with them (or no package). The time picked is
// checked now and again when the payment clears.
export async function startPayPerCallCheckout(student: Buyer, mentorId: string, start: Date, minutes: unknown) {
  if (!isBlockMinutes(minutes)) throw new CheckoutError("Pick a 30- or 60-minute call");
  const mentor = await assertCanBuy(student.id, mentorId);
  if (!mentor.hourlyRateCents) throw new CheckoutError("This mentor hasn't set an hourly rate yet");
  if (start.getTime() < Date.now() + 5 * 60_000) throw new CheckoutError("Pick a time in the future.");
  const schedule = await prisma.user.findUniqueOrThrow({ where: { id: mentorId }, select: mentorScheduleSelect });
  const slots = await openSlotsFor(schedule, student.id, minutes, { onlyDay: dayInZone(start, tzOrDefault(schedule.timeZone)) });
  if (!slots.some((s) => s.getTime() === start.getTime())) throw new CheckoutError("That time isn't available anymore. Please pick another.", 409);
  const hourly = await ensureHourlyOffer(mentorId);
  const label = minutes === 60 ? "1-hour call" : "30-minute call";
  return createOrderCheckout({
    student,
    mentor,
    gigId: hourly.id,
    kind: "PAY_PER_CALL",
    minutes,
    rateCents: mentor.hourlyRateCents,
    format: "LIVE",
    title: `${label} with ${first(mentor.name)}`,
    description: `One ${label} on ${first(mentor.name)}'s calendar, at their hourly rate.`,
    requestedCallStart: start,
  });
}

// Everything that happens once an order is paid (by Stripe or by credit):
// emails, the parent's receipt, and for pay-per-call, booking the call.
async function afterOrderPaid(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { seller: { select: { name: true, email: true } }, buyer: { select: { name: true, email: true } }, gig: { select: { title: true } } } });
  if (!order) return;
  const title = order.packageTitle || order.gig.title;
  const orderUrl = `${SITE_URL}/orders/${order.id}`;
  await sendOrderPaidEmail(order.seller.email, title, order.buyer.name, orderUrl).catch((err) => console.error("Failed to send order-paid email:", err));
  await sendPackagePurchasedEmail(order.buyer.email, {
    packageTitle: title,
    mentorName: order.seller.name,
    hours: hoursLabel(order.minutesPurchased),
    rate: money(order.rateCents || 0),
    amount: money(order.amount),
    creditApplied: order.creditAppliedCents > 0 ? money(order.creditAppliedCents) : "",
    orderUrl,
  }).catch((err) => console.error("Failed to send purchase email:", err));
  // Students under 18: their parent or guardian gets a receipt (#109).
  await sendParentReceipt(orderId).catch((err) => console.error("Failed to send the parent receipt:", err));
  if (order.kind === "PAY_PER_CALL" && order.requestedCallStart) await bookRequestedCall(orderId);
}

// Pay-per-call: books the time the student picked before paying. If it was
// taken meanwhile, the paid order stays (with its minutes) and the student
// is asked to pick another time on the order page.
async function bookRequestedCall(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderForCallsInclude });
  if (!order?.requestedCallStart) return;
  try {
    await bookCall(order, order.requestedCallStart, { id: order.buyerId, isMentor: false }, order.minutesPurchased);
    await prisma.order.update({ where: { id: orderId }, data: { requestedCallStart: null } });
  } catch (err) {
    if (!(err instanceof CallError)) console.error("Booking a paid call failed", orderId, err);
    await sendCallTimeTakenEmail(order.buyer.email, { mentorName: order.seller.name, packageTitle: order.packageTitle || order.gig.title, orderUrl: `${SITE_URL}/orders/${orderId}` }).catch(() => {});
  }
}

// Webhook: Stripe says the order's page was paid. Only PENDING_PAYMENT ->
// IN_ESCROW, once.
export async function fulfilOrderPayment(orderId: string, session: Stripe.Checkout.Session) {
  const fundsAvailableAt = await fundsAvailableFor(session);
  const claim = await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING_PAYMENT" },
    data: { status: "IN_ESCROW", fundsAvailableAt, stripePaymentIntentId: session.id, paidAt: new Date() },
  });
  if (claim.count === 1) {
    await afterOrderPaid(orderId);
    return;
  }
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (order?.status === "CANCELLED") {
    // Paid after we cancelled it (shouldn't happen: a cancelled page is
    // expired first). Someone needs to look.
    const note = `[NEEDS MANUAL CHECK] Order ${orderId} was paid on Stripe (session ${session.id}) after it was cancelled; its credit may have been given back. Refund the payment or reopen the order.`;
    console.error(note);
    await reportError(note, undefined, { orderId }, "fatal");
  }
}

// ---------- Top-ups ----------

// "Add hours": 1, 2, 3 or 5 hours at the order's own per-hour rate.
export async function startTopUpCheckout(student: Buyer, orderId: string, hours: unknown) {
  if (typeof hours !== "number" || !TOP_UP_HOURS.includes(hours)) throw new CheckoutError("Pick how many hours to add");
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { seller: { select: { name: true } }, gig: { select: { title: true } } } });
  if (!order || order.buyerId !== student.id || !order.kind) throw new CheckoutError("Package not found", 404);
  const phase = finishPhase(order);
  if (phase !== "WORKING" && phase !== "AWAITING_STUDENT") throw new CheckoutError(phase === "DISPUTED" ? "Hours can't be added while a dispute is open." : "This package isn't active anymore.");
  if (!order.rateCents) throw new CheckoutError("This package can't take more hours");
  // An existing package: the mentor may be paused for new students, but
  // the account gate and blocks still apply.
  const gate = await gateBlockReason(student.id);
  if (gate) throw new CheckoutError(gate, 403, "ACCOUNT_GATE");
  const blocks = await blockBetween(student.id, order.sellerId);
  if (blocks.iBlocked || blocks.theyBlocked) throw new CheckoutError("You can't add hours with this mentor.", 403);
  const minutes = hours * 60;
  const total = priceFor(minutes, order.rateCents);
  const title = order.packageTitle || order.gig.title;

  const { topUp, chargeCents, creditCents } = await prisma.$transaction(async (tx) => {
    await lockCredit(tx, student.id);
    const split = splitCredit(total, await creditBalance(student.id, tx));
    const topUp = await tx.hourTopUp.create({
      data: { orderId, buyerId: student.id, minutes, rateCents: order.rateCents!, amountCents: total, creditAppliedCents: split.creditCents, status: "PENDING" },
    });
    await spendCredit(tx, { userId: student.id, amountCents: split.creditCents, orderId, topUpId: topUp.id, note: `Hours added: ${title}` });
    return { topUp, ...split };
  });

  if (chargeCents === 0) {
    await applyTopUp(topUp.id, null);
    return { url: `/orders/${orderId}?hours_added=1` };
  }
  try {
    const session = await stripePage({
      name: `${hoursLabel(minutes)} more: ${title}`,
      description: `${hoursLabel(minutes)} with ${order.seller.name} at ${money(order.rateCents)}/hr.`,
      chargeCents,
      creditCents,
      email: student.email,
      metadata: { topUpId: topUp.id, orderId },
      successUrl: `${siteUrl()}/orders/${orderId}?hours_added=1`,
      cancelUrl: `${siteUrl()}/api/checkout/cancel?topUpId=${topUp.id}`,
    });
    await prisma.hourTopUp.update({ where: { id: topUp.id }, data: { stripeSessionId: session.id } });
    return { url: session.url! };
  } catch (err) {
    await prisma.hourTopUp.updateMany({ where: { id: topUp.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    await reverseCredit({ topUpId: topUp.id }, "Checkout couldn't start");
    console.error("Stripe top-up checkout failed", err);
    throw new CheckoutError("Couldn't start checkout. Please try again.", 502);
  }
}

// Adds a paid top-up's minutes to its order, once.
export async function applyTopUp(topUpId: string, session: Stripe.Checkout.Session | null) {
  const applied = await prisma.$transaction(async (tx) => {
    const claim = await tx.hourTopUp.updateMany({
      where: { id: topUpId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date(), ...(session ? { stripeSessionId: session.id, stripePaymentIntentId: (session.payment_intent as string) || null } : {}) },
    });
    if (!claim.count) return null;
    const topUp = await tx.hourTopUp.findUniqueOrThrow({ where: { id: topUpId } });
    await tx.order.update({ where: { id: topUp.orderId }, data: { minutesPurchased: { increment: topUp.minutes } } });
    return topUp;
  });
  if (!applied) {
    const t = await prisma.hourTopUp.findUnique({ where: { id: topUpId }, select: { status: true } });
    if (t?.status === "CANCELLED" && session) {
      const note = `[NEEDS MANUAL CHECK] Top-up ${topUpId} was paid on Stripe (session ${session.id}) after it was cancelled. Add the hours by hand or refund the payment.`;
      console.error(note);
      await reportError(note, undefined, { topUpId }, "fatal");
    }
    return;
  }
  const order = await prisma.order.findUnique({
    where: { id: applied.orderId },
    include: { buyer: { select: { email: true } }, gig: { select: { title: true } }, hourEntries: true, callBookings: true },
  });
  if (!order) return;
  await sendParentReceipt(order.id, applied.id).catch((err) => console.error("Failed to send the parent receipt:", err));
  const left = hoursSummary(order).left;
  // Back above 1 hour: the "1 hour left" email can go again later.
  if (left > LOW_HOURS_MINUTES && order.lowHoursEmailAt) await prisma.order.update({ where: { id: order.id }, data: { lowHoursEmailAt: null } });
  await sendHoursAddedEmail(order.buyer.email, {
    packageTitle: order.packageTitle || order.gig.title,
    hours: hoursLabel(applied.minutes),
    hoursLeft: hoursLabel(left),
    creditApplied: applied.creditAppliedCents > 0 ? money(applied.creditAppliedCents) : "",
    orderUrl: `${SITE_URL}/orders/${order.id}`,
  }).catch((err) => console.error("Hours-added email failed", err));
}

// ---------- Expired / cancelled checkouts ----------

// The Stripe page expired (webhook) or the student left it: cancel the
// order / top-up if it's still unpaid and give the credit back.
export async function cancelUnpaid(target: { orderId?: string; topUpId?: string }) {
  if (target.topUpId) {
    const res = await prisma.hourTopUp.updateMany({ where: { id: target.topUpId, status: "PENDING" }, data: { status: "CANCELLED" } });
    if (res.count) await reverseCredit({ topUpId: target.topUpId }, "Checkout not completed");
    return res.count > 0;
  }
  if (target.orderId) {
    const res = await prisma.order.updateMany({ where: { id: target.orderId, status: "PENDING_PAYMENT", kind: { not: null } }, data: { status: "CANCELLED" } });
    if (res.count) await reverseCredit({ orderId: target.orderId }, "Checkout not completed");
    return res.count > 0;
  }
  return false;
}

// The student clicked "back" on Stripe: expire that page first (so it can't
// be paid any more), then cancel. If it was already paid, nothing changes.
export async function cancelFromStripePage(studentId: string, target: { orderId?: string; topUpId?: string }) {
  let sessionId: string | null = null;
  let back = "/orders";
  if (target.topUpId) {
    const t = await prisma.hourTopUp.findUnique({ where: { id: target.topUpId } });
    if (!t || t.buyerId !== studentId) return back;
    sessionId = t.stripeSessionId;
    back = `/orders/${t.orderId}?topup=cancelled`;
    if (t.status !== "PENDING") return back;
  } else if (target.orderId) {
    const o = await prisma.order.findUnique({ where: { id: target.orderId } });
    if (!o || o.buyerId !== studentId) return back;
    sessionId = o.stripePaymentIntentId;
    back = `/mentors/${o.sellerId}?checkout=cancelled`;
    if (o.status !== "PENDING_PAYMENT" || !o.kind) return o.status === "IN_ESCROW" ? `/orders/${o.id}` : back;
  } else {
    return back;
  }
  if (sessionId) {
    try {
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      if (s.status === "complete") return back; // paid after all: the webhook handles it
      if (s.status === "open") await stripe.checkout.sessions.expire(sessionId);
    } catch (err) {
      // Can't confirm it's closed: leave it for the "expired" webhook.
      console.error("Couldn't expire the checkout page", err);
      return back;
    }
  }
  await cancelUnpaid(target);
  return back;
}

