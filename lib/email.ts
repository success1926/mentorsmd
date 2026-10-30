import { Resend } from "resend";
import { fmtInZone } from "@/lib/tz";
import { siteUrl } from "@/lib/siteUrl";
import { prisma } from "@/lib/prisma";
import { logEmail } from "@/lib/emailLog";
import { allowEmailTo } from "@/lib/rateLimit";
import { EMAILS, blocks, previewText, renderEmail, validateTemplate, type Values } from "@/lib/emailTemplates";

// Lazy, like lib/stripe.ts: the Resend constructor throws if the API key
// is missing, which would otherwise crash every route that imports this
// file (messaging, orders, webhooks) - not just the email sends.
let _resend: Resend | null = null;
export const resend = {
  emails: {
    // Resend returns { error } instead of throwing when a send fails, so
    // every try/catch around an email send used to silently "succeed".
    // Throwing here makes failures visible (logs, the invite warning, etc).
    send: async (...args: Parameters<Resend["emails"]["send"]>) => {
      if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
      const result = await _resend.emails.send(...args);
      if (result.error) throw new Error(`Email send failed: ${result.error.message}`);
      return result;
    },
  },
};

const FROM = process.env.INVITE_EMAIL_FROM || "notifications@yourdomain.com";
const SITE_URL = siteUrl();

// ---- Templates (Admin -> Emails) ----
// The wording of every email lives in lib/emailTemplates.ts (the default)
// and, once an admin edits it, in the EmailTemplate table. Values are
// always HTML-escaped by the renderer, so a user can't put a fake link or
// HTML in their name or a message.

type Attachment = { filename: string; content: Buffer; content_type?: string };
type Extra = { attachments?: Attachment[]; reply_to?: string };

// The saved wording for one email, or null to use the default. Any problem
// (database down, a saved version that's no longer valid) falls back to
// the default so the email still goes out.
async function savedTemplate(key: string) {
  try {
    const row = await prisma.emailTemplate.findUnique({ where: { key } });
    if (!row) return null;
    const errors = validateTemplate(EMAILS[key], row);
    if (errors.length) {
      console.error(`Saved email template "${key}" isn't valid, using the default:`, errors.join(" "));
      return null;
    }
    return row;
  } catch (err) {
    console.error(`Couldn't load the email template "${key}", using the default:`, err);
    return null;
  }
}

// Sends one email and writes the attempt to the email log.
async function deliver(key: string, to: string, subject: string, html: string, extra: Extra = {}) {
  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      ...(extra.reply_to ? { reply_to: extra.reply_to } : {}),
      subject,
      attachments: extra.attachments,
      html,
    });
    await logEmail({ templateKey: key, toEmail: to, subject, status: "SENT", providerId: result.data?.id ?? null });
    return result;
  } catch (err) {
    await logEmail({ templateKey: key, toEmail: to, subject, status: "FAILED", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// Emails that anyone can make the site send (by typing an address into a
// public form, or by asking again and again): at most this many of each
// to one address per hour. Past that, the email is quietly skipped (and
// shown as not sent in Admin -> Email log), so the forms still give their
// usual answer and never reveal whether an address has an account.
const PER_ADDRESS_HOURLY: Record<string, number> = {
  password_reset: 3,
  email_verification: 3,
  // A parent can have several children signing up the same evening, so
  // this one allows more (it still stops someone flooding an address).
  parent_consent: 10,
  contact_received: 3,
  application_received: 3,
  admin_code: 6,
  login_code: 6,
};

async function sendTemplate(key: string, to: string, values: Values, extra: Extra = {}) {
  const def = EMAILS[key];
  if (!def) throw new Error(`Unknown email template: ${key}`);
  const cap = PER_ADDRESS_HOURLY[key];
  if (cap && !(await allowEmailTo(key, to, cap))) {
    await logEmail({ templateKey: key, toEmail: to, subject: def.name, status: "FAILED", error: `Not sent: more than ${cap} of these to this address in the last hour.` });
    return null;
  }
  const tpl = (await savedTemplate(key)) || def;
  const { subject, html } = renderEmail(def, tpl, values);
  return deliver(key, to, subject, html, extra);
}

// Reminder emails from the daily cron (lib/scheduledEmails.ts). Throws if
// the send fails, so the cron can try again the next day.
export async function sendReminderEmail(key: string, toEmail: string, values: Values) {
  if (!EMAILS[key]?.schedule) throw new Error(`Not a reminder email: ${key}`);
  return sendTemplate(key, toEmail, values);
}

// Admin -> Emails -> "Send test to me": the wording in the editor (saved
// or not), filled with sample data, to the admin's own address only.
export async function sendTestEmail(key: string, toEmail: string, tpl: { subject: string; body: string }) {
  const def = EMAILS[key];
  if (!def) throw new Error(`Unknown email template: ${key}`);
  const values = Object.fromEntries(def.vars.map((v) => [v.name, v.sample]));
  const { subject, html } = renderEmail(def, tpl, values);
  return deliver(key, toEmail, `[Test] ${subject}`.slice(0, 160), html);
}

const first = (name: string) => name.split(" ")[0];
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export async function sendSellerInviteEmail(toEmail: string, inviteUrl: string) {
  await sendTemplate("mentor_invite", toEmail, { inviteLink: inviteUrl });
}

// Sent to whoever DIDN'T just send a message - so if a buyer messages a
// coach, the coach gets this (not the buyer). Real-time delivery via
// Live updates (Supabase Realtime) cover people actively on the site; this covers people who
// aren't, so a message doesn't sit unseen for days.
export async function sendNewMessageEmail(toEmail: string, fromName: string, previewMessage: string, conversationUrl: string) {
  await sendTemplate("new_message", toEmail, { fromName, messagePreview: previewText(previewMessage), conversationLink: conversationUrl });
}

export async function sendOrderPaidEmail(sellerEmail: string, gigTitle: string, buyerName: string, orderUrl: string) {
  await sendTemplate("new_order", sellerEmail, { studentName: buyerName, packageTitle: gigTitle, orderLink: orderUrl });
}

export async function sendOrderReleasedEmail(sellerEmail: string, gigTitle: string, amountCents: number, orderUrl: string) {
  await sendTemplate("payment_released", sellerEmail, { packageTitle: gigTitle, amount: money(amountCents), orderLink: orderUrl });
}

export async function sendRevisionRequestedEmail(sellerEmail: string, gigTitle: string, note: string, orderUrl: string) {
  await sendTemplate("revision_requested", sellerEmail, { packageTitle: gigTitle, note, orderLink: orderUrl });
}

export async function sendDisputeOpenedEmail(adminEmail: string, gigTitle: string, reason: string, orderUrl: string) {
  await sendTemplate("dispute_opened", adminEmail, { packageTitle: gigTitle, reason, orderLink: orderUrl });
}

export async function sendReviewReceivedEmail(sellerEmail: string, rating: number, gigTitle: string, profileUrl: string) {
  await sendTemplate("review_received", sellerEmail, { rating: String(rating), packageTitle: gigTitle, profileLink: profileUrl });
}

// Sent to the student the moment the mentor marks work complete - starts
// the 96-hour window they have to review before payment releases
// automatically. Includes the mentor's delivery note and file names.
export async function sendWorkCompleteEmail(
  buyerEmail: string,
  gigTitle: string,
  orderUrl: string,
  delivery?: { number: number; description: string; files: { name: string }[] }
) {
  const files = delivery?.files || [];
  await sendTemplate("work_delivered", buyerEmail, {
    packageTitle: gigTitle,
    deliveryLabel: delivery && delivery.number > 1 ? ` (delivery ${delivery.number})` : "",
    deliveryNote: delivery ? blocks.deliveryNote(delivery.description) : "",
    fileCount: files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "",
    fileNames: files.map((f) => f.name).join(", "),
    orderLink: orderUrl,
  });
}

// Sent whenever someone posts in a dispute thread - to whoever DIDN'T
// just post. If an admin asks a question, the buyer and seller both get
// notified; if either of them replies, every admin gets notified.
export async function sendDisputeMessageEmail(toEmail: string, fromName: string, gigTitle: string, previewMessage: string, orderUrl: string) {
  await sendTemplate("dispute_reply", toEmail, { fromName, packageTitle: gigTitle, messagePreview: previewText(previewMessage), orderLink: orderUrl });
}

// Sent when someone uses "Forgot password?". The link works once and
// expires after an hour.
export async function sendPasswordResetEmail(toEmail: string, resetUrl: string) {
  await sendTemplate("password_reset", toEmail, { resetLink: resetUrl });
}

// ---- Calls ----

// The bare address from INVITE_EMAIL_FROM ("MentorsMD <x@y.com>" -> "x@y.com"),
// used as the organizer in calendar invites.
export function fromAddress() {
  const m = FROM.match(/<([^>]+)>/);
  return (m ? m[1] : FROM).trim();
}

export type CallEmail = {
  gigTitle: string;
  start: Date;
  end: Date;
  timeZone: string; // the recipient's
  otherName: string;
  orderUrl: string;
  joinUrl: string;
  ics?: string; // calendar invite (.ics) to attach
};

function callWhen(c: CallEmail) {
  const day = fmtInZone(c.start, c.timeZone, { hour: undefined, minute: undefined, timeZoneName: undefined, weekday: "long", month: "long" });
  const from = c.start.toLocaleTimeString("en-US", { timeZone: c.timeZone, hour: "numeric", minute: "2-digit" });
  const to = c.end.toLocaleTimeString("en-US", { timeZone: c.timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  return `${day}, ${from} to ${to}`;
}

function icsAttachment(c: CallEmail, cancel = false) {
  return c.ics ? [{ filename: cancel ? "cancelled.ics" : "invite.ics", content: Buffer.from(c.ics), content_type: `text/calendar; charset=utf-8; method=${cancel ? "CANCEL" : "REQUEST"}` }] : undefined;
}

const callValues = (c: CallEmail): Values => ({ packageTitle: c.gigTitle, otherName: c.otherName, when: callWhen(c), joinLink: c.joinUrl, orderLink: c.orderUrl });

// Sent to both sides when a call is booked or rescheduled, with a
// calendar invite attached.
// lateReason: the call was moved within 24 hours of the start (see
// lib/calls.ts isLateChange); quoted in the "Call moved" email.
export async function sendCallScheduledEmail(toEmail: string, c: CallEmail, rescheduled = false, late?: { by: string; reason: string }) {
  const values = rescheduled && late ? { ...callValues(c), lateReason: `${late.by} moved it with less than 24 hours to go. Their reason: "${late.reason}"` } : callValues(c);
  await sendTemplate(rescheduled ? "call_rescheduled" : "call_booked", toEmail, values, { attachments: icsAttachment(c) });
}

export async function sendCallCancelledEmail(toEmail: string, c: CallEmail, cancelledBy: string) {
  await sendTemplate("call_cancelled", toEmail, { ...callValues(c), cancelledBy }, { attachments: icsAttachment(c, true) });
}

// "Your call is today" (8am local) and "Your call starts in 1 hour".
export async function sendCallReminderEmail(toEmail: string, c: CallEmail, kind: "morning" | "hour") {
  await sendTemplate(kind === "hour" ? "call_reminder_hour" : "call_reminder_today", toEmail, callValues(c));
}

// Free 15-minute intro calls (redesign Oct 2026). orderUrl in the
// CallEmail is the conversation link (there's no order).
const introValues = (c: CallEmail): Values => ({ otherName: c.otherName, when: callWhen(c), joinLink: c.joinUrl, manageLink: c.orderUrl });

export async function sendIntroCallBookedEmail(toEmail: string, c: CallEmail) {
  await sendTemplate("intro_call_booked", toEmail, introValues(c), { attachments: icsAttachment(c) });
}

export async function sendIntroCallCancelledEmail(toEmail: string, c: CallEmail, cancelledBy: string) {
  await sendTemplate("intro_call_cancelled", toEmail, { ...introValues(c), cancelledBy }, { attachments: icsAttachment(c, true) });
}

export async function sendIntroCallReminderEmail(toEmail: string, c: CallEmail, kind: "morning" | "hour") {
  await sendTemplate("intro_call_reminder", toEmail, {
    ...introValues(c),
    soon: kind === "hour" ? "Starting in 1 hour" : "Today",
    soonLower: kind === "hour" ? "in about an hour" : "today",
  });
}

// ---- Packages and hours (redesign Oct 2026) ----

export async function sendPackagePurchasedEmail(toEmail: string, v: { packageTitle: string; mentorName: string; hours: string; rate: string; amount: string; creditApplied: string; orderUrl: string }) {
  await sendTemplate("package_purchased", toEmail, { ...v, orderLink: v.orderUrl });
}

export async function sendHoursAddedEmail(toEmail: string, v: { packageTitle: string; hours: string; hoursLeft: string; creditApplied: string; orderUrl: string }) {
  await sendTemplate("hours_added", toEmail, { ...v, orderLink: v.orderUrl });
}

export async function sendHoursLowEmail(toEmail: string, v: { packageTitle: string; mentorName: string; hoursLeft: string; orderUrl: string }) {
  await sendTemplate("hours_low", toEmail, { ...v, orderLink: v.orderUrl });
}

export async function sendMoreHoursSuggestedEmail(toEmail: string, v: { mentorName: string; packageTitle: string; hours: string; hoursLeft: string; note: string; addHoursUrl: string }) {
  const { addHoursUrl, ...rest } = v;
  await sendTemplate("more_hours_suggested", toEmail, { ...rest, note: v.note ? blocks.quote(v.note) : "", addHoursLink: addHoursUrl });
}

export async function sendHoursLowMentorEmail(toEmail: string, v: { packageTitle: string; studentName: string; hoursLeft: string; orderUrl: string }) {
  await sendTemplate("hours_low_mentor", toEmail, { ...v, orderLink: v.orderUrl });
}

export async function sendWrittenTimeLoggedEmail(toEmail: string, v: { mentorName: string; packageTitle: string; minutes: string; note: string; hoursLeft: string; orderUrl: string }) {
  await sendTemplate("written_time_logged", toEmail, { ...v, note: v.note ? blocks.quote(v.note) : "", orderLink: v.orderUrl });
}

export async function sendWorkMarkedCompleteEmail(toEmail: string, v: { mentorName: string; packageTitle: string; deadline: Date; orderUrl: string }) {
  const deadline = v.deadline.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " UTC";
  await sendTemplate("work_marked_complete", toEmail, { mentorName: v.mentorName, packageTitle: v.packageTitle, deadline, orderLink: v.orderUrl });
}

export async function sendLastRequestEmail(toEmail: string, v: { studentName: string; request: string; packageTitle: string; note: string; orderUrl: string }) {
  await sendTemplate("last_request", toEmail, { ...v, note: v.note ? blocks.quote(v.note) : "", orderLink: v.orderUrl });
}

export async function sendPackageApprovedEmail(toEmail: string, v: { packageTitle: string; studentName: string; mentorName: string; auto: boolean; forMentor: boolean; orderUrl: string }) {
  await sendTemplate("package_approved", toEmail, {
    packageTitle: v.packageTitle,
    studentName: v.studentName,
    mentorName: v.mentorName,
    how: v.auto ? "approved automatically after 48 hours" : "approved",
    mentorLine: v.forMentor ? "Your earnings for it, including any unused hours, are paid with the monthly payout on the 24th." : "",
    orderLink: v.orderUrl,
  });
}

// Monthly payout sent (lib/payouts.ts).
export async function sendPayoutSentEmail(toEmail: string, v: { name: string; period: string; amount: string; hours: string; heldNote: string }) {
  await sendTemplate("payout_sent", toEmail, { firstName: first(v.name), period: v.period, amount: v.amount, hours: v.hours, heldNote: v.heldNote, dashboardLink: `${SITE_URL}/dashboard` });
}

// MentorsMD credit added (a dispute refunded as credit, or an admin adjustment).
export async function sendCreditIssuedEmail(toEmail: string, v: { name: string; amount: string; packageTitle?: string | null; note?: string | null; balance: string }) {
  await sendTemplate("credit_issued", toEmail, {
    firstName: first(v.name),
    amount: v.amount,
    forPackage: v.packageTitle ? ` for ${v.packageTitle}` : "",
    note: v.note ? blocks.quote(v.note) : "",
    balance: v.balance,
    mentorsLink: `${SITE_URL}/mentors`,
    creditLink: `${SITE_URL}/credit`,
  });
}

// Gifts from a parent (lib/gifts.ts): to the student, and the parent's receipt.
export async function sendGiftReceivedEmail(
  toEmail: string,
  v: { studentName: string; parentName: string; giftShort: string; giftLine: string; note: string | null; claimUrl: string | null; claimDays: number }
) {
  await sendTemplate("gift_received", toEmail, {
    firstName: first(v.studentName),
    parentName: v.parentName,
    giftShort: v.giftShort,
    giftLine: v.giftLine,
    note: v.note ? blocks.quote(v.note) : "",
    claimLink: v.claimUrl || "",
    loginLink: v.claimUrl ? "" : `${SITE_URL}/login`,
    claimHelp: v.claimUrl ? `This link works for ${v.claimDays} days. After that, use Forgot password on the login page.` : "",
  });
}

export async function sendGiftReceiptEmail(
  toEmail: string,
  v: { parentName: string; studentName: string; giftLine: string; amountCents: number; paidAt: Date; under18: boolean; giftUrl: string }
) {
  await sendTemplate("gift_receipt", toEmail, {
    parentFirstName: first(v.parentName),
    studentName: v.studentName,
    studentFirstName: first(v.studentName),
    giftLine: v.giftLine,
    amount: money(v.amountCents),
    paidOn: v.paidAt.toDateString(),
    consentNote: v.under18
      ? `Because ${first(v.studentName)} is under 18, they'll need your consent before they can use MentorsMD. That's a separate email we send you once they set up their account.`
      : "",
    giftLink: v.giftUrl,
  });
}

export async function sendCallTimeTakenEmail(toEmail: string, v: { mentorName: string; packageTitle: string; orderUrl: string }) {
  await sendTemplate("call_time_taken", toEmail, { mentorName: v.mentorName, packageTitle: v.packageTitle, orderLink: v.orderUrl });
}

// What happened at a call (lib/callOutcomeRunner.ts): a no-show or
// nobody joined. One email per person; the key picks the wording.
export type CallOutcomeEmailKey =
  | "call_student_no_show_student"
  | "call_student_no_show_mentor"
  | "call_mentor_no_show_student"
  | "call_mentor_no_show_mentor"
  | "call_nobody_joined";
export async function sendCallOutcomeEmail(toEmail: string, key: CallOutcomeEmailKey, c: CallEmail, secondMissed = "") {
  await sendTemplate(key, toEmail, { ...callValues(c), secondMissed });
}

// ---- Mentor applications ----

// Where new mentor applications are sent. Set APPLICATIONS_EMAIL in Vercel
// to change it.
export const APPLICATIONS_EMAIL = process.env.APPLICATIONS_EMAIL || "success@mentorsmd.com";

type ApplicationForEmail = {
  name: string;
  email: string;
  phone: string;
  medicalSchool: string;
  residency: string | null;
  blurb: string;
  resumeName: string;
};

// To the MentorsMD team. Reply-to is the applicant, so hitting Reply in
// the inbox answers them directly. The resume is attached when we could
// read it; the link is always included as a backup.
export async function sendApplicationEmail(app: ApplicationForEmail, adminUrl: string, resumeLink: string, resume?: { filename: string; content: Buffer }) {
  await sendTemplate(
    "mentor_application",
    APPLICATIONS_EMAIL,
    {
      applicantName: app.name,
      applicantEmail: app.email,
      phone: app.phone,
      medicalSchool: app.medicalSchool,
      residency: app.residency || "-",
      about: blocks.quote(app.blurb),
      resumeStatus: resume ? "attached" : "not attached",
      resumeName: app.resumeName,
      resumeLink, // admin-only download link (résumés are private files)
      adminLink: adminUrl,
    },
    { reply_to: app.email, attachments: resume ? [resume] : undefined }
  );
}

// To the applicant, right after they submit.
export async function sendApplicationReceivedEmail(toEmail: string, name: string) {
  await sendTemplate("application_received", toEmail, { firstName: first(name) }, { reply_to: APPLICATIONS_EMAIL });
}

// ---- Safety (Phase 4) ----

// "Confirm your email" - students confirm before sending their first message.
export async function sendEmailVerificationEmail(toEmail: string, name: string, verifyUrl: string) {
  await sendTemplate("email_verification", toEmail, { firstName: first(name), verifyLink: verifyUrl });
}

// Instant alert to every admin for a high-severity flag.
export async function sendHighSeverityFlagEmail(
  toEmail: string,
  flag: { kind: string; reason: string; evidence?: string | null; details?: string | null; subjectName?: string | null },
  adminUrl: string
) {
  await sendTemplate("high_severity_flag", toEmail, {
    reason: flag.reason,
    aboutWhom: flag.subjectName ? ` (about ${flag.subjectName})` : "",
    evidence: flag.evidence ? previewText(flag.evidence) : "",
    details: flag.details ? previewText(flag.details) : "",
    adminLink: adminUrl,
  });
}

export type DigestSummary = {
  open: number;
  newThisWeek: number;
  high: number;
  byKind: { kind: string; count: number }[];
  autoPaused: { name: string }[];
  top: { reason: string; subjectName: string | null; severity: number }[];
};

// Monday digest for admins.
export async function sendSafetyDigestEmail(toEmail: string, d: DigestSummary, adminUrl: string) {
  await sendTemplate("safety_digest", toEmail, {
    openFlags: `${d.open} open flag${d.open === 1 ? "" : "s"}`,
    newFlags: `${d.newThisWeek} new flag${d.newThisWeek === 1 ? "" : "s"}`,
    openCount: String(d.open),
    highCount: String(d.high),
    byKind: d.byKind.map((k) => `${k.kind.toLowerCase().replace(/_/g, " ")}: ${k.count}`).join(" · "),
    autoPaused: d.autoPaused.map((u) => u.name).join(", "),
    topFlags: blocks.topFlags(d.top),
    adminLink: adminUrl,
  });
}

// An admin's warning to a student or mentor.
export async function sendSafetyWarningEmail(toEmail: string, name: string, reason: string, note: string | null) {
  await sendTemplate("safety_warning", toEmail, { firstName: first(name), reason, teamNote: note ? blocks.quote(note) : "", siteLink: SITE_URL });
}

// Account paused pending review (by an admin or automatically).
export async function sendAccountPausedEmail(toEmail: string, name: string, isMentor: boolean) {
  await sendTemplate(isMentor ? "account_paused_mentor" : "account_paused_student", toEmail, { firstName: first(name) });
}

// ---- Minors and parental consent (Phase 5) ----

// To a parent or guardian: please consent (also used for the reminders).
export async function sendParentConsentEmail(
  toEmail: string,
  parentName: string,
  studentName: string,
  consentUrl: string,
  expiresAt: Date,
  reminder = false
) {
  await sendTemplate(reminder ? "parent_consent_reminder" : "parent_consent", toEmail, {
    parentFirstName: first(parentName),
    studentName,
    studentFirstName: first(studentName),
    consentLink: consentUrl,
    expiresOn: expiresAt.toDateString(),
  });
}

// To the parent once they've consented: their private parent link.
export async function sendParentConsentConfirmedEmail(toEmail: string, parentName: string, studentName: string, parentUrl: string) {
  await sendTemplate("parent_consent_confirmed", toEmail, {
    parentFirstName: first(parentName),
    studentName,
    studentFirstName: first(studentName),
    parentLink: parentUrl,
  });
}

// To the parent: a receipt for each order the student pays for.
export async function sendParentReceiptEmail(
  toEmail: string,
  parentName: string,
  studentName: string,
  order: { gigTitle: string; mentorName: string; amountCents: number; paidAt: Date; dueDate: Date | null },
  parentUrl: string
) {
  await sendTemplate("parent_receipt", toEmail, {
    parentFirstName: first(parentName),
    studentName,
    packageTitle: order.gigTitle,
    mentorName: order.mentorName,
    amount: money(order.amountCents),
    paidOn: order.paidAt.toDateString(),
    dueDate: order.dueDate ? order.dueDate.toDateString() : "",
    parentLink: parentUrl,
  });
}

// To the student when their minor status changes.
export async function sendMinorStatusEmail(toEmail: string, name: string, kind: "CONSENTED" | "DECLINED" | "WITHDRAWN" | "ADULT") {
  const key = { CONSENTED: "minor_consented", DECLINED: "minor_declined", WITHDRAWN: "minor_withdrawn", ADULT: "minor_turned_18" }[kind];
  await sendTemplate(key, toEmail, { firstName: first(name), siteLink: SITE_URL });
}

// ---- Admin team (Phase 5) ----

export async function sendAdminInviteEmail(toEmail: string, inviterName: string, roleLabel: string, inviteUrl: string) {
  await sendTemplate("admin_invite", toEmail, { inviterName, roleLabel, inviteLink: inviteUrl });
}

export async function sendAdminCodeEmail(toEmail: string, code: string) {
  await sendTemplate("admin_code", toEmail, { code });
}

// The 2-step login code for mentors and students (admins get admin_code).
export async function sendLoginCodeEmail(toEmail: string, code: string) {
  await sendTemplate("login_code", toEmail, { code });
}

// Security notice: someone's 2-step method changed (Settings, or set up at
// their first login).
export async function sendTwoStepChangedEmail(toEmail: string, name: string, change: string) {
  await sendTemplate("two_step_changed", toEmail, { firstName: first(name), change, siteLink: SITE_URL });
}

export async function sendTeamAccessChangedEmail(toEmail: string, name: string, text: string) {
  await sendTemplate("team_access_changed", toEmail, { firstName: first(name), message: text });
}

// ---- Leads: contact form and waitlist (Oct 2026) ----

// To the team inbox (the same one as mentor applications). Reply-to is
// the sender, so hitting Reply answers them directly.
export async function sendContactMessageEmail(m: { name: string; email: string; topic: string; message: string }, adminUrl: string) {
  await sendTemplate(
    "contact_message",
    APPLICATIONS_EMAIL,
    { senderName: m.name, senderEmail: m.email, topic: m.topic, message: blocks.quote(m.message), adminLink: adminUrl },
    { reply_to: m.email }
  );
}

// To the sender, right after they use the contact form.
// Only a plain first name is used (anything that looks like a link or is
// long becomes "there"), so the form can't be used to send links.
export async function sendContactReceivedEmail(toEmail: string, name: string) {
  const f = first(name);
  const firstName = f.length <= 30 && /^[\p{L}' -]+$/u.test(f) ? f : "there";
  await sendTemplate("contact_received", toEmail, { firstName }, { reply_to: APPLICATIONS_EMAIL });
}

// To one waitlist signup (Admin -> Leads -> Waitlist -> Email everyone).
export async function sendWaitlistMentorsAvailableEmail(toEmail: string, removeUrl: string) {
  await sendTemplate("waitlist_mentors_available", toEmail, { mentorsLink: `${SITE_URL}/mentors`, removeLink: removeUrl });
}

export { SITE_URL };
