import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.INVITE_EMAIL_FROM || "notifications@yourdomain.com";
const SITE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function sendSellerInviteEmail(toEmail: string, inviteUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "You're invited to coach on MentorsMD",
    html: `
      <p>You've been invited to set up a coach profile.</p>
      <p><a href="${inviteUrl}">Click here to accept the invite and set up your profile</a></p>
      <p>This link expires in 7 days and can only be used once.</p>
    `,
  });
}

// Sent to whoever DIDN'T just send a message - so if a buyer messages a
// coach, the coach gets this (not the buyer). Real-time delivery via
// Pusher covers people actively on the site; this covers people who
// aren't, so a message doesn't sit unseen for days.
export async function sendNewMessageEmail(toEmail: string, fromName: string, preview: string, conversationUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `New message from ${fromName}`,
    html: `
      <p><strong>${fromName}</strong> sent you a message:</p>
      <p style="color:#555;">"${preview.slice(0, 140)}${preview.length > 140 ? "..." : ""}"</p>
      <p><a href="${conversationUrl}">Reply on MentorsMD</a></p>
    `,
  });
}

export async function sendOrderPaidEmail(sellerEmail: string, gigTitle: string, buyerName: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `New order: ${gigTitle}`,
    html: `
      <p><strong>${buyerName}</strong> just booked and paid for <strong>${gigTitle}</strong>.</p>
      <p><a href="${orderUrl}">View the order</a></p>
    `,
  });
}

export async function sendOrderReleasedEmail(sellerEmail: string, gigTitle: string, amountCents: number, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `Payment released: ${gigTitle}`,
    html: `
      <p>Payment for <strong>${gigTitle}</strong> has been released to you - $${(amountCents / 100).toFixed(2)} is on its way to your bank account.</p>
      <p><a href="${orderUrl}">View the order</a></p>
    `,
  });
}

export async function sendRevisionRequestedEmail(sellerEmail: string, gigTitle: string, note: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `Revision requested: ${gigTitle}`,
    html: `
      <p>A revision was requested for <strong>${gigTitle}</strong>:</p>
      <p style="color:#555;">"${note}"</p>
      <p><a href="${orderUrl}">View the order</a></p>
    `,
  });
}

export async function sendDisputeOpenedEmail(adminEmail: string, gigTitle: string, reason: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `Dispute opened: ${gigTitle}`,
    html: `
      <p>A buyer opened a dispute on <strong>${gigTitle}</strong>:</p>
      <p style="color:#555;">"${reason}"</p>
      <p><a href="${orderUrl}">Review the order</a></p>
    `,
  });
}

export async function sendReviewReceivedEmail(sellerEmail: string, rating: number, gigTitle: string, profileUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `New ${rating}-star review`,
    html: `
      <p>You received a new ${rating}-star review for <strong>${gigTitle}</strong>.</p>
      <p><a href="${profileUrl}">View your profile</a></p>
    `,
  });
}

// Sent to the buyer the moment a coach marks work complete - starts the
// 96-hour window they have to review before payment releases automatically.
export async function sendWorkCompleteEmail(buyerEmail: string, gigTitle: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: `${gigTitle} is ready for review`,
    html: `
      <p>Your coach marked <strong>${gigTitle}</strong> as complete.</p>
      <p>You have 96 hours to review it. If you don't take any action, payment releases to your coach automatically once that window passes.</p>
      <p><a href="${orderUrl}">Review the work</a></p>
    `,
  });
}

// Sent once per day to a seller whose work is past the buyer's due date
// and hasn't been marked complete yet. See /api/cron/overdue-reminders.
export async function sendOverdueReminderEmail(sellerEmail: string, gigTitle: string, dueDate: Date, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `Reminder: ${gigTitle} is overdue`,
    html: `
      <p><strong>${gigTitle}</strong> was due on ${dueDate.toLocaleDateString()} and hasn't been marked complete yet.</p>
      <p>Mark it done as soon as it's ready so the buyer can review it.</p>
      <p><a href="${orderUrl}">View the order</a></p>
    `,
  });
}

// Sent whenever someone posts in a dispute thread - to whoever DIDN'T
// just post. If an admin asks a question, the buyer and seller both get
// notified; if either of them replies, every admin gets notified.
export async function sendDisputeMessageEmail(toEmail: string, fromName: string, gigTitle: string, preview: string, orderUrl: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `New reply on the ${gigTitle} dispute`,
    html: `
      <p><strong>${fromName}</strong> replied on the dispute for <strong>${gigTitle}</strong>:</p>
      <p style="color:#555;">"${preview.slice(0, 140)}${preview.length > 140 ? "..." : ""}"</p>
      <p><a href="${orderUrl}">View the dispute</a></p>
    `,
  });
}

export { SITE_URL };
