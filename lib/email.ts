import { Resend } from "resend";
import { fmtInZone } from "@/lib/tz";

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
const SITE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

// Every user-supplied value (names, notes, message text, gig titles) is
// escaped before it goes into an email's HTML. Without this, a user could
// put a fake "click here to verify your account" link in their name or a
// message, and it would arrive looking like it came from MentorsMD.
function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function preview(text: string) {
  return esc(text.slice(0, 140)) + (text.length > 140 ? "..." : "");
}

// Strip newlines from subjects (header injection) and cap their length.
function subj(text: string) {
  return text.replace(/[\r\n]+/g, " ").slice(0, 150);
}

export async function sendSellerInviteEmail(toEmail: string, inviteUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "You're invited to mentor on MentorsMD",
    html: `
      <p>You've been invited to set up a mentor profile.</p>
      <p><a href="${esc(inviteUrl)}">Click here to accept the invite and set up your profile</a></p>
      <p>This link expires in 7 days and can only be used once.</p>
    `,
  });
}

// Sent to whoever DIDN'T just send a message - so if a buyer messages a
// coach, the coach gets this (not the buyer). Real-time delivery via
// Pusher covers people actively on the site; this covers people who
// aren't, so a message doesn't sit unseen for days.
export async function sendNewMessageEmail(toEmail: string, fromName: string, previewText: string, conversationUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: subj(`New message from ${fromName}`),
    html: `
      <p><strong>${esc(fromName)}</strong> sent you a message:</p>
      <p style="color:#555;">"${preview(previewText)}"</p>
      <p><a href="${esc(conversationUrl)}">Reply on MentorsMD</a></p>
    `,
  });
}

export async function sendOrderPaidEmail(sellerEmail: string, gigTitle: string, buyerName: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: subj(`New order: ${gigTitle}`),
    html: `
      <p><strong>${esc(buyerName)}</strong> just booked and paid for <strong>${esc(gigTitle)}</strong>.</p>
      <p><a href="${esc(orderUrl)}">View the order</a></p>
    `,
  });
}

export async function sendOrderReleasedEmail(sellerEmail: string, gigTitle: string, amountCents: number, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: subj(`Payment released: ${gigTitle}`),
    html: `
      <p>Payment for <strong>${esc(gigTitle)}</strong> has been released to you - $${(amountCents / 100).toFixed(2)} is on its way to your bank account.</p>
      <p><a href="${esc(orderUrl)}">View the order</a></p>
    `,
  });
}

export async function sendRevisionRequestedEmail(sellerEmail: string, gigTitle: string, note: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: subj(`Revision requested: ${gigTitle}`),
    html: `
      <p>A revision was requested for <strong>${esc(gigTitle)}</strong>:</p>
      <p style="color:#555;">"${esc(note)}"</p>
      <p><a href="${esc(orderUrl)}">View the order</a></p>
    `,
  });
}

export async function sendDisputeOpenedEmail(adminEmail: string, gigTitle: string, reason: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: subj(`Dispute opened: ${gigTitle}`),
    html: `
      <p>A student opened a dispute on <strong>${esc(gigTitle)}</strong>:</p>
      <p style="color:#555;">"${esc(reason)}"</p>
      <p><a href="${esc(orderUrl)}">Review the order</a></p>
    `,
  });
}

export async function sendReviewReceivedEmail(sellerEmail: string, rating: number, gigTitle: string, profileUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: subj(`New ${rating}-star review`),
    html: `
      <p>You received a new ${rating}-star review for <strong>${esc(gigTitle)}</strong>.</p>
      <p><a href="${esc(profileUrl)}">View your profile</a></p>
    `,
  });
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
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: subj(`${gigTitle} is ready for review`),
    html: `
      <p>Your mentor delivered <strong>${esc(gigTitle)}</strong>${delivery && delivery.number > 1 ? ` (delivery ${delivery.number})` : ""}.</p>
      ${delivery ? `<p><strong>Their note:</strong></p><p style="color:#555;white-space:pre-wrap;">${esc(delivery.description)}</p>` : ""}
      ${files.length ? `<p>${files.length} file${files.length === 1 ? "" : "s"} attached on the order page: ${files.map((f) => esc(f.name)).join(", ")}</p>` : ""}
      <p>You have 96 hours to review it. Payment is held until you approve; if you don't take any action, it releases to your mentor automatically once that window passes.</p>
      <p><a href="${esc(orderUrl)}">Review the work</a></p>
    `,
  });
}

// Sent once per day to a seller whose work is past the buyer's due date
// and hasn't been marked complete yet. See /api/cron/overdue-reminders.
export async function sendOverdueReminderEmail(sellerEmail: string, gigTitle: string, dueDate: Date, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: subj(`Reminder: ${gigTitle} is overdue`),
    html: `
      <p><strong>${esc(gigTitle)}</strong> was due on ${dueDate.toLocaleDateString()} and hasn't been marked complete yet.</p>
      <p>Mark it done as soon as it's ready so the student can review it.</p>
      <p><a href="${esc(orderUrl)}">View the order</a></p>
    `,
  });
}

// Sent whenever someone posts in a dispute thread - to whoever DIDN'T
// just post. If an admin asks a question, the buyer and seller both get
// notified; if either of them replies, every admin gets notified.
export async function sendDisputeMessageEmail(toEmail: string, fromName: string, gigTitle: string, previewText: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: subj(`New reply on the ${gigTitle} dispute`),
    html: `
      <p><strong>${esc(fromName)}</strong> replied on the dispute for <strong>${esc(gigTitle)}</strong>:</p>
      <p style="color:#555;">"${preview(previewText)}"</p>
      <p><a href="${esc(orderUrl)}">View the dispute</a></p>
    `,
  });
}

// Sent when someone uses "Forgot password?". The link works once and
// expires after an hour.
export async function sendPasswordResetEmail(toEmail: string, resetUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "Reset your MentorsMD password",
    html: `
      <p>Someone (hopefully you) asked to reset the password for this MentorsMD account.</p>
      <p><a href="${esc(resetUrl)}">Choose a new password</a></p>
      <p style="color:#555;">This link expires in 1 hour and can only be used once. If you didn't ask for this, you can ignore this email and your password won't change.</p>
    `,
  });
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

const CALL_FOOTER = `<p style="color:#777;font-size:13px;">Calls happen in a private MentorsMD video room. Calls may be recorded for safety and quality; only the MentorsMD team can watch a recording, and only if there's a problem with an order.</p>`;

// Sent to both sides when a call is booked or rescheduled, with a
// calendar invite attached.
export async function sendCallScheduledEmail(toEmail: string, c: CallEmail, rescheduled = false) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: subj(`${rescheduled ? "Call moved" : "Call booked"}: ${c.gigTitle}`),
    attachments: icsAttachment(c),
    html: `
      <p>Your call with <strong>${esc(c.otherName)}</strong> for <strong>${esc(c.gigTitle)}</strong> is ${rescheduled ? "now " : ""}set for:</p>
      <p style="font-size:17px;"><strong>${esc(callWhen(c))}</strong></p>
      <p>Join from <a href="${esc(c.joinUrl)}">your call page</a>. The Join button opens 10 minutes before the start. The attached invite adds it to your calendar.</p>
      <p>Need to change it? You can reschedule or cancel on the <a href="${esc(c.orderUrl)}">order page</a> up to 24 hours before the call.</p>
      ${CALL_FOOTER}
    `,
  });
}

export async function sendCallCancelledEmail(toEmail: string, c: CallEmail, cancelledBy: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: subj(`Call cancelled: ${c.gigTitle}`),
    attachments: icsAttachment(c, true),
    html: `
      <p>${esc(cancelledBy)} cancelled the call for <strong>${esc(c.gigTitle)}</strong> that was set for ${esc(callWhen(c))}.</p>
      <p>A new time can be booked from the order page.</p>
      <p><a href="${esc(c.orderUrl)}">View the order</a></p>
    `,
  });
}

// "Your call is today" (8am local) and "Your call starts in 1 hour".
export async function sendCallReminderEmail(toEmail: string, c: CallEmail, kind: "morning" | "hour") {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: subj(kind === "hour" ? `Starting in 1 hour: your call with ${c.otherName}` : `Today: your call with ${c.otherName}`),
    html: `
      <p>${kind === "hour" ? "Your call starts in about an hour." : "Just a reminder: you have a call today."}</p>
      <p><strong>${esc(c.gigTitle)}</strong> with ${esc(c.otherName)}<br/>${esc(callWhen(c))}</p>
      <p><a href="${esc(c.joinUrl)}" style="display:inline-block;background:#5536D6;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;">Join the call</a></p>
      <p style="color:#555;">The Join button works from 10 minutes before the start. Use a quiet spot and allow camera and microphone access when your browser asks.</p>
      ${CALL_FOOTER}
    `,
  });
}

// Mentor added busy dates that cover due dates they already agreed to.
export async function sendBusyClashEmail(toEmail: string, clashes: { gigTitle: string; studentName: string; due: string; url: string }[]) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "Your new busy dates overlap existing deadlines",
    html: `
      <p>The busy dates you just added cover ${clashes.length === 1 ? "a due date" : "due dates"} you already have:</p>
      <ul>${clashes.map((c) => `<li><a href="${esc(c.url)}">${esc(c.gigTitle)}</a> for ${esc(c.studentName)}, due ${esc(c.due)}</li>`).join("")}</ul>
      <p>Existing orders keep their due dates. Deliver early, or message the student and change the due date on the order.</p>
    `,
  });
}

// Nudges the student while a call included in their package is unbooked.
export async function sendBookCallReminderEmail(buyerEmail: string, gigTitle: string, dueDate: Date | null, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: subj(`Book your call: ${gigTitle}`),
    html: `
      <p>Your package <strong>${esc(gigTitle)}</strong> includes a call with your mentor that isn't booked yet.</p>
      ${dueDate ? `<p>Please book it before <strong>${esc(dueDate.toDateString())}</strong>.</p>` : ""}
      <p><a href="${esc(orderUrl)}">Book a call</a></p>
    `,
  });
}

// The due date passed with a call still unbooked: the order is paused.
export async function sendCallHoldEmail(toEmail: string, gigTitle: string, orderUrl: string, forStudent: boolean) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: subj(`Action needed: ${gigTitle}`),
    html: forStudent
      ? `
      <p>The due date for <strong>${esc(gigTitle)}</strong> has passed and the call included in it isn't booked.</p>
      <p>You have 48 hours to book it, or to tell us you don't need it. After that, the call is forfeited and your mentor can complete the order.</p>
      <p><a href="${esc(orderUrl)}">Book now or skip the call</a></p>
    `
      : `
      <p>The due date for <strong>${esc(gigTitle)}</strong> has passed and the student hasn't booked the included call.</p>
      <p>The order is paused. We've asked the student to book within 48 hours. You can extend the due date, message them, or contact us.</p>
      <p><a href="${esc(orderUrl)}">View the order</a></p>
    `,
  });
}

export async function sendCallForfeitedEmail(toEmail: string, gigTitle: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: subj(`Call not booked: ${gigTitle}`),
    html: `
      <p>The call included in <strong>${esc(gigTitle)}</strong> wasn't booked within 48 hours of the due date, so it has been marked as forfeited.</p>
      <p>The mentor can now mark the order complete.</p>
      <p><a href="${esc(orderUrl)}">View the order</a></p>
    `,
  });
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
  resumeUrl: string;
  resumeName: string;
};

// To the MentorsMD team. Reply-to is the applicant, so hitting Reply in
// the inbox answers them directly. The resume is attached when we could
// read it; the link is always included as a backup.
export async function sendApplicationEmail(app: ApplicationForEmail, adminUrl: string, resume?: { filename: string; content: Buffer }) {
  await resend.emails.send({
    from: FROM,
    to: APPLICATIONS_EMAIL,
    reply_to: app.email,
    subject: subj(`Mentor application: ${app.name}`),
    attachments: resume ? [resume] : undefined,
    html: `
      <p><strong>New mentor application</strong></p>
      <p>
        <strong>Name:</strong> ${esc(app.name)}<br/>
        <strong>Email:</strong> ${esc(app.email)}<br/>
        <strong>Phone:</strong> ${esc(app.phone)}<br/>
        <strong>Medical school:</strong> ${esc(app.medicalSchool)}<br/>
        <strong>Residency:</strong> ${esc(app.residency || "-")}
      </p>
      <p><strong>About them:</strong></p>
      <p style="color:#555;white-space:pre-wrap;">${esc(app.blurb)}</p>
      <p><strong>Resume:</strong> ${resume ? "attached" : "not attached"} (<a href="${esc(app.resumeUrl)}">${esc(app.resumeName)}</a>)</p>
      <p><a href="${esc(adminUrl)}">Invite or decline in Admin</a>. Reply to this email to answer ${esc(app.name)} directly.</p>
    `,
  });
}

// To the applicant, right after they submit.
export async function sendApplicationReceivedEmail(toEmail: string, name: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    reply_to: APPLICATIONS_EMAIL,
    subject: "We got your MentorsMD application",
    html: `
      <p>Hi ${esc(name.split(" ")[0])},</p>
      <p>Thanks for applying to mentor on MentorsMD. Our senior team reviews every application and usually replies within a few days.</p>
      <p>If you're a fit, we'll email you a one-time invite link to set up your mentor profile. You can reply to this email if you have any questions.</p>
    `,
  });
}

// ---- Safety (Phase 4) ----

// "Confirm your email" - students confirm before sending their first message.
export async function sendEmailVerificationEmail(toEmail: string, name: string, verifyUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "Confirm your email for MentorsMD",
    html: `
      <p>Hi ${esc(name.split(" ")[0])},</p>
      <p>Please confirm this is your email address so you can message mentors on MentorsMD.</p>
      <p><a href="${esc(verifyUrl)}">Confirm my email</a></p>
      <p style="color:#555;">This link expires in 48 hours. If you didn't create a MentorsMD account, you can ignore this email.</p>
    `,
  });
}

// Instant alert to every admin for a high-severity flag.
export async function sendHighSeverityFlagEmail(
  toEmail: string,
  flag: { kind: string; reason: string; evidence?: string | null; details?: string | null; subjectName?: string | null },
  adminUrl: string
) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: subj(`High-severity flag: ${flag.reason}`),
    html: `
      <p><strong>${esc(flag.reason)}</strong>${flag.subjectName ? ` (about ${esc(flag.subjectName)})` : ""}</p>
      ${flag.evidence ? `<p style="color:#555;">"${preview(flag.evidence)}"</p>` : ""}
      ${flag.details ? `<p style="color:#555;">${preview(flag.details)}</p>` : ""}
      <p><a href="${esc(adminUrl)}">Review it in Admin → Flags</a></p>
    `,
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
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: subj(`MentorsMD safety digest: ${d.open} open flag${d.open === 1 ? "" : "s"}`),
    html: `
      <p><strong>This week on MentorsMD</strong></p>
      <p>${d.newThisWeek} new flag${d.newThisWeek === 1 ? "" : "s"} in the last 7 days · ${d.open} open in total · ${d.high} open high-severity</p>
      ${d.byKind.length ? `<p>${d.byKind.map((k) => `${esc(k.kind.toLowerCase().replace(/_/g, " "))}: ${k.count}`).join(" · ")}</p>` : ""}
      ${d.autoPaused.length ? `<p>Paused automatically (3 upheld flags in 90 days): ${d.autoPaused.map((u) => esc(u.name)).join(", ")}</p>` : ""}
      ${d.top.length ? `<p><strong>Most serious open flags</strong></p><ul>${d.top.map((t) => `<li>${esc(t.reason)}${t.subjectName ? ` (${esc(t.subjectName)})` : ""}</li>`).join("")}</ul>` : ""}
      <p><a href="${esc(adminUrl)}">Open Admin → Flags</a></p>
    `,
  });
}

// An admin's warning to a student or mentor.
export async function sendSafetyWarningEmail(toEmail: string, name: string, reason: string, note: string | null) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "A note from the MentorsMD team",
    html: `
      <p>Hi ${esc(name.split(" ")[0])},</p>
      <p>Our team reviewed recent activity on your account and found something that goes against our Community Guidelines: <strong>${esc(reason)}</strong>.</p>
      ${note ? `<p style="color:#555;white-space:pre-wrap;">${esc(note)}</p>` : ""}
      <p>Please take a moment to read the <a href="${esc(SITE_URL)}/community-guidelines">Community Guidelines</a>. Repeated problems can lead to your account being paused or removed.</p>
      <p>Reply to this email if you think we got this wrong.</p>
    `,
  });
}

// Account paused pending review (by an admin or automatically).
export async function sendAccountPausedEmail(toEmail: string, name: string, isMentor: boolean) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "Your MentorsMD account is paused for review",
    html: `
      <p>Hi ${esc(name.split(" ")[0])},</p>
      <p>Your account has been paused while our team reviews some recent reports. ${
        isMentor
          ? "Your profile is hidden from search for now. Your current orders are not affected, and payments already held stay protected."
          : "You can't send new messages for now. Your current orders are not affected, and payments already held stay protected."
      }</p>
      <p>We'll be in touch. Reply to this email if you'd like to share anything with us.</p>
    `,
  });
}

export { SITE_URL };
