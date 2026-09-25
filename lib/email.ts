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
    subject: "You're invited to coach on MentorsMD",
    html: `
      <p>You've been invited to set up a coach profile.</p>
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
      <p>A buyer opened a dispute on <strong>${esc(gigTitle)}</strong>:</p>
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

// Sent to the buyer the moment a coach marks work complete - starts the
// 96-hour window they have to review before payment releases automatically.
export async function sendWorkCompleteEmail(buyerEmail: string, gigTitle: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: subj(`${gigTitle} is ready for review`),
    html: `
      <p>Your coach marked <strong>${esc(gigTitle)}</strong> as complete.</p>
      <p>You have 96 hours to review it. If you don't take any action, payment releases to your coach automatically once that window passes.</p>
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
      <p>Mark it done as soon as it's ready so the buyer can review it.</p>
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

export { SITE_URL };
