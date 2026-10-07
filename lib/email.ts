import { Resend } from "resend";

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

// Sent to both sides when a call is booked or rescheduled.
export async function sendCallBookedEmail(toEmail: string, gigTitle: string, when: Date, orderUrl: string, rescheduled = false) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: subj(`${rescheduled ? "Call rescheduled" : "Call booked"}: ${gigTitle}`),
    html: `
      <p>A call for <strong>${esc(gigTitle)}</strong> is ${rescheduled ? "now" : ""} set for <strong>${esc(when.toUTCString())}</strong>.</p>
      <p>The Join button on the order page opens 10 minutes before the start time.</p>
      <p><a href="${esc(orderUrl)}">View the order</a></p>
    `,
  });
}

export async function sendCallCancelledEmail(toEmail: string, gigTitle: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: subj(`Call cancelled: ${gigTitle}`),
    html: `
      <p>The call for <strong>${esc(gigTitle)}</strong> was cancelled. You can book a new time from the order page.</p>
      <p><a href="${esc(orderUrl)}">View the order</a></p>
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

export { SITE_URL };
