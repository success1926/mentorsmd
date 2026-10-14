// Editable email templates (Admin -> Emails).
//
// Every automatic email the site sends has an entry in EMAILS below: a
// plain-language name and description, who receives it, the {{variables}}
// it can use, and a DEFAULT subject and body that match the wording the
// site has always used. Admins can change the wording in Admin -> Emails;
// the saved version lives in the EmailTemplate table. With nothing saved,
// the default is used, so every email is exactly what it was before.
//
// This file has no database or server code, so the Admin editor can use
// the same renderer for its live preview.
//
// Body formatting (deliberately small, no raw HTML):
//   blank line          new paragraph
//   Enter               line break inside a paragraph
//   **bold**            bold text
//   [text]({{link}})    a link (the address must be a link variable or https://...)
//   [[text]]({{link}})  a purple button
//   > at the start      grey note text
//   >> at the start     small grey print
//   # at the start      very large text (login codes)
//   ## at the start     large text
//   {{blockVariable}}   on its own paragraph: a prepared section (a list, a note)
// A line that uses an optional variable is left out when that variable is
// empty (for example "Due: {{dueDate}}" when there's no due date).

export type VarKind = "text" | "link" | "block";
export type EmailVar = {
  name: string;
  label: string; // plain-language description shown in the editor
  sample: string; // used for the live preview and test emails
  kind?: VarKind; // default "text"
  optional?: boolean; // lines using it are dropped when it's empty
};
export type EmailGroup = "STUDENTS" | "MENTORS" | "BOTH" | "PARENTS" | "TEAM";
export type EmailDef = {
  key: string;
  name: string;
  description: string;
  group: EmailGroup;
  subject: string;
  body: string;
  vars: EmailVar[];
  required?: string[]; // variables that must stay in the body (security-sensitive emails)
};

export const GROUP_LABELS: Record<EmailGroup, string> = {
  STUDENTS: "Students",
  MENTORS: "Mentors",
  BOTH: "Students and mentors",
  PARENTS: "Parents",
  TEAM: "Team",
};
export const GROUP_ORDER: EmailGroup[] = ["STUDENTS", "MENTORS", "BOTH", "PARENTS", "TEAM"];

// ---- Escaping ----

// Every value that goes into an email's HTML is escaped. Without this, a
// user could put a fake "click here to verify your account" link in their
// name or a message, and it would arrive looking like it came from MentorsMD.
export function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Shortened quote of a message (first 140 characters).
export function previewText(text: string) {
  return text.slice(0, 140) + (text.length > 140 ? "..." : "");
}

// Strip newlines from subjects (header injection) and cap their length.
export function subj(text: string) {
  return text.replace(/[\r\n]+/g, " ").slice(0, 150);
}

// ---- Prepared sections ("block" variables) ----
// Built here so the live preview uses exactly what real emails use.
export const blocks = {
  // The mentor's delivery note (keeps their line breaks).
  deliveryNote: (text: string) => `<p><strong>Their note:</strong></p><p style="color:#555;white-space:pre-wrap;">${esc(text)}</p>`,
  // Longer text someone typed, line breaks kept, in grey.
  quote: (text: string) => `<p style="color:#555;white-space:pre-wrap;">${esc(text)}</p>`,
  clashList: (clashes: { gigTitle: string; studentName: string; due: string; url: string }[]) =>
    `<ul>${clashes.map((c) => `<li><a href="${esc(c.url)}">${esc(c.gigTitle)}</a> for ${esc(c.studentName)}, due ${esc(c.due)}</li>`).join("")}</ul>`,
  topFlags: (top: { reason: string; subjectName: string | null }[]) =>
    top.length ? `<p><strong>Most serious open flags</strong></p><ul>${top.map((t) => `<li>${esc(t.reason)}${t.subjectName ? ` (${esc(t.subjectName)})` : ""}</li>`).join("")}</ul>` : "",
};

// ---- Shared variables ----
const SITE = "https://mentorsmd.com";
const text = (name: string, label: string, sample: string, extra: Partial<EmailVar> = {}): EmailVar => ({ name, label, sample, ...extra });
const link = (name: string, label: string, sample: string, extra: Partial<EmailVar> = {}): EmailVar => ({ name, label, sample, kind: "link", ...extra });
const block = (name: string, label: string, sample: string): EmailVar => ({ name, label, sample, kind: "block", optional: true });

const V = {
  packageTitle: text("packageTitle", "The package's title", "Personal statement review"),
  orderLink: link("orderLink", "Link to the order page", `${SITE}/orders/sample-order`),
  firstName: text("firstName", "The recipient's first name", "Jordan"),
  studentName: text("studentName", "The student's full name", "Jordan Lee"),
  mentorName: text("mentorName", "The mentor's full name", "Dr. Priya Shah"),
  otherName: text("otherName", "The other person on the call", "Priya Shah"),
  when: text("when", "Day and time of the call, in the recipient's time zone", "Tuesday, October 21, 4:00 PM to 5:00 PM EDT"),
  joinLink: link("joinLink", "Link to the call page (Join button)", `${SITE}/calls/sample-call`),
  siteLink: link("siteLink", "The MentorsMD home page", SITE),
  adminLink: link("adminLink", "Link to the right page in Admin", `${SITE}/admin`),
  parentLink: link("parentLink", "The parent's private page", `${SITE}/parent/sample-link`),
};

const CALL_FOOTER = ">> Calls happen in a private MentorsMD video room. Calls may be recorded for safety and quality; only the MentorsMD team can watch a recording, and only if there's a problem with an order.";

function minorStatus(key: string, name: string, description: string, subject: string, sentence: string): EmailDef {
  return {
    key, name, description, group: "STUDENTS", subject,
    body: `Hi {{firstName}},\n\n${sentence}\n\n[Go to MentorsMD]({{siteLink}})`,
    vars: [V.firstName, V.siteLink],
  };
}

// ---- Every automatic email ----
const LIST: EmailDef[] = [
  // ----- Students -----
  {
    key: "work_delivered",
    name: "Work delivered",
    description: "Sent to the student when the mentor marks the work complete. Starts the 96-hour review window.",
    group: "STUDENTS",
    subject: "{{packageTitle}} is ready for review",
    body: [
      "Your mentor delivered **{{packageTitle}}**{{deliveryLabel}}.",
      "{{deliveryNote}}",
      "{{fileCount}} attached on the order page: {{fileNames}}",
      "You have 96 hours to review it. Payment is held until you approve; if you don't take any action, it releases to your mentor automatically once that window passes.",
      "[Review the work]({{orderLink}})",
    ].join("\n\n"),
    vars: [
      V.packageTitle,
      text("deliveryLabel", 'Says " (delivery 2)" for a second or later delivery; empty for the first', " (delivery 2)"),
      block("deliveryNote", "The mentor's note with the delivery (left out if there's none)", blocks.deliveryNote("Here are my edits. The second paragraph is much stronger now.")),
      text("fileCount", 'How many files, e.g. "2 files"', "2 files", { optional: true }),
      text("fileNames", "The file names, separated by commas", "Essay-v2.docx, Notes.pdf", { optional: true }),
      V.orderLink,
    ],
  },
  {
    key: "book_call_reminder",
    name: "Book your call",
    description: "Reminds the student while a call included in their package isn't booked yet.",
    group: "STUDENTS",
    subject: "Book your call: {{packageTitle}}",
    body: [
      "Your package **{{packageTitle}}** includes a call with your mentor that isn't booked yet.",
      "Please book it before **{{bookBy}}**.",
      "[Book a call]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.packageTitle, text("bookBy", "The order's due date (the line is left out if there's none)", "Fri Oct 24 2026", { optional: true }), V.orderLink],
  },
  {
    key: "call_on_hold_student",
    name: "Order on hold (student)",
    description: "Sent to the student when the due date passes and the included call still isn't booked. They have 48 hours.",
    group: "STUDENTS",
    subject: "Action needed: {{packageTitle}}",
    body: [
      "The due date for **{{packageTitle}}** has passed and the call included in it isn't booked.",
      "You have 48 hours to book it, or to tell us you don't need it. After that, the call is forfeited and your mentor can complete the order.",
      "[Book now or skip the call]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.packageTitle, V.orderLink],
  },
  {
    key: "email_verification",
    name: "Confirm your email",
    description: "Sent to a student to confirm their email address before their first message.",
    group: "STUDENTS",
    subject: "Confirm your email for MentorsMD",
    body: [
      "Hi {{firstName}},",
      "Please confirm this is your email address so you can message mentors on MentorsMD.",
      "[Confirm my email]({{verifyLink}})",
      "> This link expires in 48 hours. If you didn't create a MentorsMD account, you can ignore this email.",
    ].join("\n\n"),
    vars: [V.firstName, link("verifyLink", "The one-time confirmation link", `${SITE}/api/email/verify?token=sample`)],
    required: ["verifyLink"],
  },
  {
    key: "account_paused_student",
    name: "Account paused (student)",
    description: "Sent to a student when their account is paused for review, by an admin or automatically.",
    group: "STUDENTS",
    subject: "Your MentorsMD account is paused for review",
    body: [
      "Hi {{firstName}},",
      "Your account has been paused while our team reviews some recent reports. You can't send new messages for now. Your current orders are not affected, and payments already held stay protected.",
      "We'll be in touch. Reply to this email if you'd like to share anything with us.",
    ].join("\n\n"),
    vars: [V.firstName],
  },
  minorStatus("minor_consented", "Under 18: account ready", "Sent to a student under 18 when their parent or guardian gives consent.", "Your MentorsMD account is ready",
    "Your parent or guardian gave their consent, so your account is now active. You can message mentors and book packages."),
  minorStatus("minor_declined", "Under 18: consent declined", "Sent to a student under 18 when their parent or guardian declines consent.", "Your parent or guardian didn't give consent",
    "Your parent or guardian chose not to give consent, so your MentorsMD account stays paused. If this was a mistake, you can send them a new request after logging in."),
  minorStatus("minor_withdrawn", "Under 18: consent withdrawn", "Sent to a student under 18 when their parent or guardian withdraws consent.", "Your MentorsMD account is paused",
    "Your parent or guardian withdrew their consent, so your account is paused. Our team will contact your parent or guardian about any open orders."),
  minorStatus("minor_turned_18", "Turned 18", "Sent to a student on their 18th birthday, when their account becomes a regular account.", "Happy birthday from MentorsMD",
    "You're 18 now, so your account is a regular account: parental consent is no longer needed, and your parent's link to your orders has stopped working."),

  // ----- Mentors -----
  {
    key: "mentor_invite",
    name: "Mentor invite",
    description: "Sent to a new mentor with their one-time link to set up a profile.",
    group: "MENTORS",
    subject: "You're invited to mentor on MentorsMD",
    body: [
      "You've been invited to set up a mentor profile.",
      "[Click here to accept the invite and set up your profile]({{inviteLink}})",
      "This link expires in 7 days and can only be used once.",
    ].join("\n\n"),
    vars: [link("inviteLink", "The one-time invite link", `${SITE}/become-a-mentor/join?token=sample`)],
    required: ["inviteLink"],
  },
  {
    key: "application_received",
    name: "Application received",
    description: "Sent to someone who applies to mentor, right after they submit. Replies go to the applications inbox.",
    group: "MENTORS",
    subject: "We got your MentorsMD application",
    body: [
      "Hi {{firstName}},",
      "Thanks for applying to mentor on MentorsMD. Our senior team reviews every application and usually replies within a few days.",
      "If you're a fit, we'll email you a one-time invite link to set up your mentor profile. You can reply to this email if you have any questions.",
    ].join("\n\n"),
    vars: [V.firstName],
  },
  {
    key: "new_order",
    name: "New order",
    description: "Sent to the mentor when a student pays for a package.",
    group: "MENTORS",
    subject: "New order: {{packageTitle}}",
    body: ["**{{studentName}}** just booked and paid for **{{packageTitle}}**.", "[View the order]({{orderLink}})"].join("\n\n"),
    vars: [V.studentName, V.packageTitle, V.orderLink],
  },
  {
    key: "payment_released",
    name: "Payment released",
    description: "Sent to the mentor when payment for an order is released to them.",
    group: "MENTORS",
    subject: "Payment released: {{packageTitle}}",
    body: [
      "Payment for **{{packageTitle}}** has been released to you - {{amount}} is on its way to your bank account.",
      "[View the order]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.packageTitle, text("amount", "The amount the mentor receives", "$70.00"), V.orderLink],
  },
  {
    key: "revision_requested",
    name: "Revision requested",
    description: "Sent to the mentor when the student asks for a revision.",
    group: "MENTORS",
    subject: "Revision requested: {{packageTitle}}",
    body: ["A revision was requested for **{{packageTitle}}**:", '> "{{note}}"', "[View the order]({{orderLink}})"].join("\n\n"),
    vars: [V.packageTitle, text("note", "What the student asked for", "Could you look at the conclusion again?"), V.orderLink],
  },
  {
    key: "review_received",
    name: "New review",
    description: "Sent to the mentor when a student leaves a review.",
    group: "MENTORS",
    subject: "New {{rating}}-star review",
    body: ["You received a new {{rating}}-star review for **{{packageTitle}}**.", "[View your profile]({{profileLink}})"].join("\n\n"),
    vars: [text("rating", "Star rating, 1 to 5", "5"), V.packageTitle, link("profileLink", "Link to the mentor's profile", `${SITE}/mentors/sample`)],
  },
  {
    key: "overdue_reminder",
    name: "Work overdue",
    description: "Sent once a day to the mentor while work is past its due date and not marked complete.",
    group: "MENTORS",
    subject: "Reminder: {{packageTitle}} is overdue",
    body: [
      "**{{packageTitle}}** was due on {{dueDate}} and hasn't been marked complete yet.",
      "Mark it done as soon as it's ready so the student can review it.",
      "[View the order]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.packageTitle, text("dueDate", "The due date", "10/20/2026"), V.orderLink],
  },
  {
    key: "busy_dates_clash",
    name: "Busy dates overlap deadlines",
    description: "Sent to a mentor who adds busy dates that cover due dates they already agreed to.",
    group: "MENTORS",
    subject: "Your new busy dates overlap existing deadlines",
    body: [
      "The busy dates you just added cover {{dueDatesPhrase}} you already have:",
      "{{clashList}}",
      "Existing orders keep their due dates. Deliver early, or message the student and change the due date on the order.",
    ].join("\n\n"),
    vars: [
      text("dueDatesPhrase", 'Says "a due date" or "due dates"', "due dates"),
      block("clashList", "The list of affected orders, with links", blocks.clashList([
        { gigTitle: "Personal statement review", studentName: "Jordan Lee", due: "Oct 24", url: `${SITE}/orders/sample-order` },
        { gigTitle: "Mock interview", studentName: "Sam Patel", due: "Oct 26", url: `${SITE}/orders/sample-order-2` },
      ])),
    ],
  },
  {
    key: "call_on_hold_mentor",
    name: "Order on hold (mentor)",
    description: "Sent to the mentor when the due date passes and the student hasn't booked the included call.",
    group: "MENTORS",
    subject: "Action needed: {{packageTitle}}",
    body: [
      "The due date for **{{packageTitle}}** has passed and the student hasn't booked the included call.",
      "The order is paused. We've asked the student to book within 48 hours. You can extend the due date, message them, or contact us.",
      "[View the order]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.packageTitle, V.orderLink],
  },
  {
    key: "account_paused_mentor",
    name: "Account paused (mentor)",
    description: "Sent to a mentor when their account is paused for review, by an admin or automatically.",
    group: "MENTORS",
    subject: "Your MentorsMD account is paused for review",
    body: [
      "Hi {{firstName}},",
      "Your account has been paused while our team reviews some recent reports. Your profile is hidden from search for now. Your current orders are not affected, and payments already held stay protected.",
      "We'll be in touch. Reply to this email if you'd like to share anything with us.",
    ].join("\n\n"),
    vars: [V.firstName],
  },

  // ----- Students and mentors -----
  {
    key: "new_message",
    name: "New message",
    description: "Sent to whoever didn't send a new message (student or mentor), so messages don't sit unseen.",
    group: "BOTH",
    subject: "New message from {{fromName}}",
    body: ["**{{fromName}}** sent you a message:", '> "{{messagePreview}}"', "[Reply on MentorsMD]({{conversationLink}})"].join("\n\n"),
    vars: [
      text("fromName", "Who sent the message", "Jordan Lee"),
      text("messagePreview", "The first 140 characters of the message", "Hi! I'd love help with my personal statement before the deadline."),
      link("conversationLink", "Link to the conversation", `${SITE}/messages/sample`),
    ],
  },
  {
    key: "password_reset",
    name: "Reset password",
    description: "Sent when someone uses \"Forgot password?\". The link works once and expires after an hour.",
    group: "BOTH",
    subject: "Reset your MentorsMD password",
    body: [
      "Someone (hopefully you) asked to reset the password for this MentorsMD account.",
      "[Choose a new password]({{resetLink}})",
      "> This link expires in 1 hour and can only be used once. If you didn't ask for this, you can ignore this email and your password won't change.",
    ].join("\n\n"),
    vars: [link("resetLink", "The one-time password reset link", `${SITE}/reset-password?token=sample`)],
    required: ["resetLink"],
  },
  {
    key: "dispute_reply",
    name: "Dispute reply",
    description: "Sent when someone posts in a dispute thread: to the student and mentor when the team writes, and to the team when either of them replies.",
    group: "BOTH",
    subject: "New reply on the {{packageTitle}} dispute",
    body: ["**{{fromName}}** replied on the dispute for **{{packageTitle}}**:", '> "{{messagePreview}}"', "[View the dispute]({{orderLink}})"].join("\n\n"),
    vars: [
      text("fromName", "Who replied", "MentorsMD team"),
      V.packageTitle,
      text("messagePreview", "The first 140 characters of the reply", "Could you both share the files you exchanged?"),
      V.orderLink,
    ],
  },
  {
    key: "call_booked",
    name: "Call booked",
    description: "Sent to the student and mentor when a call is booked, with a calendar invite attached.",
    group: "BOTH",
    subject: "Call booked: {{packageTitle}}",
    body: [
      "Your call with **{{otherName}}** for **{{packageTitle}}** is set for:",
      "## **{{when}}**",
      "Join from [your call page]({{joinLink}}). The Join button opens 10 minutes before the start. The attached invite adds it to your calendar.",
      "Need to change it? You can reschedule or cancel on the [order page]({{orderLink}}) up to 24 hours before the call.",
      CALL_FOOTER,
    ].join("\n\n"),
    vars: [V.otherName, V.packageTitle, V.when, V.joinLink, V.orderLink],
  },
  {
    key: "call_rescheduled",
    name: "Call moved",
    description: "Sent to the student and mentor when a call is rescheduled, with an updated calendar invite.",
    group: "BOTH",
    subject: "Call moved: {{packageTitle}}",
    body: [
      "Your call with **{{otherName}}** for **{{packageTitle}}** is now set for:",
      "## **{{when}}**",
      "Join from [your call page]({{joinLink}}). The Join button opens 10 minutes before the start. The attached invite adds it to your calendar.",
      "Need to change it? You can reschedule or cancel on the [order page]({{orderLink}}) up to 24 hours before the call.",
      CALL_FOOTER,
    ].join("\n\n"),
    vars: [V.otherName, V.packageTitle, V.when, V.joinLink, V.orderLink],
  },
  {
    key: "call_cancelled",
    name: "Call cancelled",
    description: "Sent to the student and mentor when a call is cancelled; removes it from their calendar.",
    group: "BOTH",
    subject: "Call cancelled: {{packageTitle}}",
    body: [
      "{{cancelledBy}} cancelled the call for **{{packageTitle}}** that was set for {{when}}.",
      "A new time can be booked from the order page.",
      "[View the order]({{orderLink}})",
    ].join("\n\n"),
    vars: [text("cancelledBy", "Who cancelled", "Priya Shah"), V.packageTitle, V.when, V.orderLink],
  },
  {
    key: "call_reminder_today",
    name: "Call today",
    description: "Sent at 8am (recipient's time) on the day of a call, to the student and mentor.",
    group: "BOTH",
    subject: "Today: your call with {{otherName}}",
    body: [
      "Just a reminder: you have a call today.",
      "**{{packageTitle}}** with {{otherName}}\n{{when}}",
      "[[Join the call]]({{joinLink}})",
      "> The Join button works from 10 minutes before the start. Use a quiet spot and allow camera and microphone access when your browser asks.",
      CALL_FOOTER,
    ].join("\n\n"),
    vars: [V.otherName, V.packageTitle, V.when, V.joinLink],
  },
  {
    key: "call_reminder_hour",
    name: "Call in 1 hour",
    description: "Sent about an hour before a call, to the student and mentor.",
    group: "BOTH",
    subject: "Starting in 1 hour: your call with {{otherName}}",
    body: [
      "Your call starts in about an hour.",
      "**{{packageTitle}}** with {{otherName}}\n{{when}}",
      "[[Join the call]]({{joinLink}})",
      "> The Join button works from 10 minutes before the start. Use a quiet spot and allow camera and microphone access when your browser asks.",
      CALL_FOOTER,
    ].join("\n\n"),
    vars: [V.otherName, V.packageTitle, V.when, V.joinLink],
  },
  {
    key: "call_forfeited",
    name: "Call forfeited",
    description: "Sent to the student and mentor when the included call wasn't booked within 48 hours of the due date.",
    group: "BOTH",
    subject: "Call not booked: {{packageTitle}}",
    body: [
      "The call included in **{{packageTitle}}** wasn't booked within 48 hours of the due date, so it has been marked as forfeited.",
      "The mentor can now mark the order complete.",
      "[View the order]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.packageTitle, V.orderLink],
  },
  {
    key: "safety_warning",
    name: "Warning from the team",
    description: "An admin's warning to a student or mentor about the Community Guidelines.",
    group: "BOTH",
    subject: "A note from the MentorsMD team",
    body: [
      "Hi {{firstName}},",
      "Our team reviewed recent activity on your account and found something that goes against our Community Guidelines: **{{reason}}**.",
      "{{teamNote}}",
      "Please take a moment to read the [Community Guidelines]({{siteLink}}/community-guidelines). Repeated problems can lead to your account being paused or removed.",
      "Reply to this email if you think we got this wrong.",
    ].join("\n\n"),
    vars: [
      V.firstName,
      text("reason", "The reason for the warning", "Sharing contact details to move off the site"),
      block("teamNote", "The note the admin wrote (left out if there's none)", blocks.quote("Please keep all communication on MentorsMD.")),
      V.siteLink,
    ],
  },

  // ----- Parents -----
  {
    key: "parent_consent",
    name: "Parental consent request",
    description: "Sent to a parent or guardian when a student under 18 signs up, asking for consent.",
    group: "PARENTS",
    subject: "{{studentName}} needs your consent to use MentorsMD",
    body: PARENT_CONSENT_BODY(),
    vars: PARENT_CONSENT_VARS(),
    required: ["consentLink"],
  },
  {
    key: "parent_consent_reminder",
    name: "Parental consent reminder",
    description: "Reminder to a parent or guardian who hasn't answered the consent request yet.",
    group: "PARENTS",
    subject: "Reminder: {{studentName}} needs your consent to use MentorsMD",
    body: PARENT_CONSENT_BODY(),
    vars: PARENT_CONSENT_VARS(),
    required: ["consentLink"],
  },
  {
    key: "parent_consent_confirmed",
    name: "Consent recorded",
    description: "Sent to the parent once they consent, with their private parent page link.",
    group: "PARENTS",
    subject: "Consent recorded for {{studentName}}",
    body: [
      "Hi {{parentFirstName}},",
      "Thank you. Your consent for **{{studentName}}** to use MentorsMD is recorded, and their account is now active.",
      "You'll get a receipt by email for every order. You can see their orders and calls at any time, or withdraw your consent, from your private parent page:",
      "[Open your parent page]({{parentLink}})",
      "> Keep this link private: anyone with it can see the order history. It stops working when {{studentFirstName}} turns 18.",
    ].join("\n\n"),
    vars: [
      text("parentFirstName", "The parent's first name", "Maria"),
      V.studentName,
      text("studentFirstName", "The student's first name", "Jordan"),
      V.parentLink,
    ],
    required: ["parentLink"],
  },
  {
    key: "parent_receipt",
    name: "Parent receipt",
    description: "A receipt sent to the parent for each order a student under 18 pays for.",
    group: "PARENTS",
    subject: "Receipt: {{studentName}} booked {{packageTitle}}",
    body: [
      "Hi {{parentFirstName}},",
      "**{{studentName}}** booked a package on MentorsMD.",
      "**Package:** {{packageTitle}}\n**Mentor:** {{mentorName}}\n**Amount paid:** {{amount}}\n**Date:** {{paidOn}}\n**Due:** {{dueDate}}",
      "Payment held until you approve: the money is only released to the mentor after the work is delivered and approved (or the review window passes).",
      "[See all orders and calls]({{parentLink}})",
    ].join("\n\n"),
    vars: [
      text("parentFirstName", "The parent's first name", "Maria"),
      V.studentName,
      V.packageTitle,
      V.mentorName,
      text("amount", "Amount paid", "$100.00"),
      text("paidOn", "Date paid", "Tue Oct 14 2026"),
      text("dueDate", "Due date (the line is left out if there's none)", "Fri Oct 24 2026", { optional: true }),
      V.parentLink,
    ],
  },

  // ----- Team -----
  {
    key: "mentor_application",
    name: "New mentor application",
    description: "Sent to the applications inbox when someone applies to mentor, with their resume attached. Reply goes to the applicant.",
    group: "TEAM",
    subject: "Mentor application: {{applicantName}}",
    body: [
      "**New mentor application**",
      "**Name:** {{applicantName}}\n**Email:** {{applicantEmail}}\n**Phone:** {{phone}}\n**Medical school:** {{medicalSchool}}\n**Residency:** {{residency}}",
      "**About them:**",
      "{{about}}",
      "**Resume:** {{resumeStatus}} ([{{resumeName}}]({{resumeLink}}))",
      "[Invite or decline in Admin]({{adminLink}}). Reply to this email to answer {{applicantName}} directly.",
    ].join("\n\n"),
    vars: [
      text("applicantName", "The applicant's name", "Dr. Priya Shah"),
      text("applicantEmail", "The applicant's email", "applicant@example.com"),
      text("phone", "The applicant's phone", "(555) 010-0000"),
      text("medicalSchool", "Their medical school", "Example School of Medicine"),
      text("residency", 'Their residency ("-" if none)', "Internal Medicine"),
      block("about", "What they wrote about themselves", blocks.quote("I'm a PGY-2 who loves helping applicants with their essays.")),
      text("resumeStatus", '"attached" or "not attached"', "attached"),
      text("resumeName", "The resume's file name", "Resume.pdf"),
      link("resumeLink", "Link to the resume", `${SITE}/sample-resume.pdf`),
      V.adminLink,
    ],
  },
  {
    key: "dispute_opened",
    name: "Dispute opened",
    description: "Sent to every admin when a student opens a dispute on an order.",
    group: "TEAM",
    subject: "Dispute opened: {{packageTitle}}",
    body: ["A student opened a dispute on **{{packageTitle}}**:", '> "{{reason}}"', "[Review the order]({{orderLink}})"].join("\n\n"),
    vars: [V.packageTitle, text("reason", "The student's reason", "The feedback didn't cover my secondary essays."), V.orderLink],
  },
  {
    key: "high_severity_flag",
    name: "High-severity flag",
    description: "Instant alert to every admin when a high-severity safety flag is raised.",
    group: "TEAM",
    subject: "High-severity flag: {{reason}}",
    body: [
      "**{{reason}}**{{aboutWhom}}",
      '> "{{evidence}}"',
      "> {{details}}",
      "[Review it in Admin → Flags]({{adminLink}})",
    ].join("\n\n"),
    vars: [
      text("reason", "Why it was flagged", "Asked for payment off the site"),
      text("aboutWhom", 'Says " (about Name)" when the flag is about a person; otherwise empty', " (about Sam Patel)"),
      text("evidence", "The flagged text, shortened (the line is left out if there's none)", "Venmo me instead and I'll give you a discount", { optional: true }),
      text("details", "Extra details, shortened (the line is left out if there's none)", "Detected by the message checker.", { optional: true }),
      V.adminLink,
    ],
  },
  {
    key: "safety_digest",
    name: "Weekly safety digest",
    description: "Sent to every admin on Mondays: a summary of open safety flags.",
    group: "TEAM",
    subject: "MentorsMD safety digest: {{openFlags}}",
    body: [
      "**This week on MentorsMD**",
      "{{newFlags}} in the last 7 days · {{openCount}} open in total · {{highCount}} open high-severity",
      "{{byKind}}",
      "Paused automatically (3 upheld flags in 90 days): {{autoPaused}}",
      "{{topFlags}}",
      "[Open Admin → Flags]({{adminLink}})",
    ].join("\n\n"),
    vars: [
      text("openFlags", 'Open flags, e.g. "3 open flags"', "3 open flags"),
      text("newFlags", 'New flags this week, e.g. "2 new flags"', "2 new flags"),
      text("openCount", "Number of open flags", "3"),
      text("highCount", "Number of open high-severity flags", "1"),
      text("byKind", "Count by kind (the line is left out if empty)", "off platform: 2 · spam: 1", { optional: true }),
      text("autoPaused", "Accounts paused automatically (the line is left out if none)", "Sam Patel", { optional: true }),
      block("topFlags", "The most serious open flags, as a list", blocks.topFlags([{ reason: "Asked for payment off the site", subjectName: "Sam Patel" }])),
      V.adminLink,
    ],
  },
  {
    key: "admin_invite",
    name: "Admin team invite",
    description: "Sent to someone invited to the admin team, with their one-time link.",
    group: "TEAM",
    subject: "You're invited to the MentorsMD admin team",
    body: [
      "{{inviterName}} invited you to join the MentorsMD team as {{roleLabel}}.",
      "[Accept the invite and set your password]({{inviteLink}})",
      "> This link expires in 7 days and can only be used once. When you first log in you'll set up 2-step verification (an authenticator app or email codes).",
    ].join("\n\n"),
    vars: [
      text("inviterName", "Who sent the invite", "Tabo"),
      text("roleLabel", "The role (Owner or Admin)", "Admin"),
      link("inviteLink", "The one-time invite link", `${SITE}/admin/join?token=sample`),
    ],
    required: ["inviteLink"],
  },
  {
    key: "admin_code",
    name: "Admin login code",
    description: "The 6-digit 2-step login code for admins who use email codes.",
    group: "TEAM",
    subject: "Your MentorsMD admin code: {{code}}",
    body: [
      "Your MentorsMD admin login code is:",
      "# **{{code}}**",
      "> It expires in 10 minutes. If you didn't just try to log in, change your password and tell the team Owner.",
    ].join("\n\n"),
    vars: [text("code", "The 6-digit code", "123456")],
    required: ["code"],
  },
  {
    key: "team_access_changed",
    name: "Admin access changed",
    description: "Sent to a team member when their admin access changes (role, disabled, removed, 2-step reset).",
    group: "TEAM",
    subject: "Your MentorsMD admin access changed",
    body: [
      "Hi {{firstName}},",
      "{{message}}",
      "> If you have questions, contact the MentorsMD team Owner.",
    ].join("\n\n"),
    vars: [V.firstName, text("message", "What changed", "Your role is now Owner.")],
  },
];

function PARENT_CONSENT_BODY() {
  return [
    "Hi {{parentFirstName}},",
    "**{{studentName}}** created a student account on MentorsMD, where students applying to medical school get one-on-one help from vetted medical students and residents.",
    "Because {{studentFirstName}} is under 18, their account stays paused until a parent or guardian reads our Terms and the Parental Consent form and consents.",
    "[[Review and give consent]]({{consentLink}})",
    '> This link expires on {{expiresOn}}. If you don\'t know this student, or don\'t want them to use MentorsMD, you can ignore this email or choose "I don\'t consent" on the page.',
  ].join("\n\n");
}
function PARENT_CONSENT_VARS(): EmailVar[] {
  return [
    text("parentFirstName", "The parent's first name", "Maria"),
    V.studentName,
    text("studentFirstName", "The student's first name", "Jordan"),
    link("consentLink", "The private consent link", `${SITE}/parent/consent?token=sample`),
    text("expiresOn", "When the consent link expires", "Tue Oct 28 2026"),
  ];
}

export const EMAILS: Record<string, EmailDef> = Object.fromEntries(LIST.map((d) => [d.key, d]));
export const EMAIL_LIST: EmailDef[] = LIST;
export type EmailKey = string;

// ---- Rendering ----

const VAR_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g;
// A link address: a {{variable}} (optionally followed by a path) or a typed https:// / mailto: address.
const URL_SRC = String.raw`(\{\{\s*[a-zA-Z][a-zA-Z0-9]*\s*\}\}[^\s)]*|https?:\/\/[^\s)]+|mailto:[^\s)]+)`;
const BUTTON_RE = new RegExp(String.raw`\[\[([^\]]+)\]\]\(` + URL_SRC + String.raw`\)`, "g");
const LINK_RE = new RegExp(String.raw`\[([^\]]+)\]\(` + URL_SRC + String.raw`\)`, "g");
const BUTTON_STYLE = "display:inline-block;background:#5536D6;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;";
const PARA_STYLES: Record<string, string> = {
  ">>": ' style="color:#777;font-size:13px;"',
  ">": ' style="color:#555;"',
  "#": ' style="font-size:28px;letter-spacing:6px;"',
  "##": ' style="font-size:17px;"',
};

export type Values = Record<string, string | undefined | null>;

function varMap(def: Pick<EmailDef, "vars">) {
  return new Map(def.vars.map((v) => [v.name, v]));
}

// Text the admin typed: no HTML allowed, so < > & are shown as written.
const escTyped = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderSubject(def: Pick<EmailDef, "vars">, subject: string, values: Values) {
  const vars = varMap(def);
  return subj(subject.replace(VAR_RE, (_, name) => (vars.has(name) && vars.get(name)!.kind !== "block" ? String(values[name] ?? "") : "")));
}

function renderLine(line: string, vars: Map<string, EmailVar>, values: Values) {
  // A link's address must be a link variable (or a typed https:// address),
  // and never a script address like javascript:.
  const isLinkVar = (url: string) => {
    const m = url.match(/^\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/);
    if (!m) return true;
    return vars.get(m[1])?.kind === "link" && !/^\s*(javascript|data|vbscript):/i.test(String(values[m[1]] ?? ""));
  };
  const href = (url: string) => url.replace(/"/g, "&quot;");
  let out = escTyped(line);
  out = out.replace(BUTTON_RE, (_, label, url) => (isLinkVar(url) ? `<a href="${href(url)}" style="${BUTTON_STYLE}">${label}</a>` : label));
  out = out.replace(LINK_RE, (_, label, url) => (isLinkVar(url) ? `<a href="${href(url)}">${label}</a>` : label));
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Values go in last and are always escaped, so nothing in a value is
  // ever treated as formatting or HTML.
  return out.replace(VAR_RE, (_, name) => {
    const v = vars.get(name);
    if (!v || v.kind === "block") return "";
    return esc(values[name] ?? "");
  });
}

export function renderBody(def: Pick<EmailDef, "vars">, body: string, values: Values) {
  const vars = varMap(def);
  const usesEmptyOptional = (line: string) =>
    Array.from(line.matchAll(VAR_RE)).some((m) => vars.get(m[1])?.optional && !values[m[1]]);
  const out: string[] = [];
  for (const raw of body.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/)) {
    const para = raw.trim();
    if (!para) continue;
    const only = para.match(/^\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}$/);
    if (only && vars.get(only[1])?.kind === "block") {
      // Prepared sections are built (and escaped) in code.
      if (values[only[1]]) out.push(String(values[only[1]]));
      continue;
    }
    const pm = para.match(/^(>>|>|##|#) /);
    const style = pm ? PARA_STYLES[pm[1]] : "";
    const rest = pm ? para.slice(pm[0].length) : para;
    const lines = rest.split("\n").map((l) => l.trim()).filter((l) => l && !usesEmptyOptional(l));
    if (!lines.length) continue;
    out.push(`<p${style}>${lines.map((l) => renderLine(l, vars, values)).join("<br/>")}</p>`);
  }
  return out.join("\n");
}

export function renderEmail(def: Pick<EmailDef, "vars">, tpl: { subject: string; body: string }, values: Values) {
  return { subject: renderSubject(def, tpl.subject, values), html: renderBody(def, tpl.body, values) };
}

export function sampleValues(def: EmailDef): Values {
  return Object.fromEntries(def.vars.map((v) => [v.name, v.sample]));
}

// ---- Checking an edited template before it's saved ----

export const SUBJECT_MAX = 150;
export const BODY_MAX = 10000;

export function validateTemplate(def: EmailDef, tpl: { subject: string; body: string }): string[] {
  const errors: string[] = [];
  const vars = varMap(def);
  const subject = tpl.subject || "";
  const body = tpl.body || "";
  if (!subject.trim()) errors.push("The subject can't be empty.");
  if (subject.length > SUBJECT_MAX) errors.push(`The subject can be at most ${SUBJECT_MAX} characters.`);
  if (/[\r\n]/.test(subject)) errors.push("The subject must be on one line.");
  if (!body.trim()) errors.push("The body can't be empty.");
  if (body.length > BODY_MAX) errors.push(`The body can be at most ${BODY_MAX.toLocaleString("en-US")} characters.`);

  const unknown = new Set<string>();
  for (const m of Array.from((subject + "\n" + body).matchAll(VAR_RE))) if (!vars.has(m[1])) unknown.add(m[1]);
  // Also catch {{ things }} that aren't valid names at all.
  for (const m of Array.from((subject + "\n" + body).matchAll(/\{\{([^}]*)\}\}/g))) {
    if (!/^\s*[a-zA-Z][a-zA-Z0-9]*\s*$/.test(m[1])) unknown.add(m[1].trim() || "(empty)");
  }
  if (unknown.size) errors.push(`This email can't use: ${Array.from(unknown).map((n) => `{{${n}}}`).join(", ")}. Use the variables listed for it.`);

  for (const m of Array.from(subject.matchAll(VAR_RE))) {
    const v = vars.get(m[1]);
    if (v?.kind === "block") errors.push(`{{${v.name}}} is a section and can only go in the body, on its own line.`);
    if (v?.kind === "link") errors.push(`{{${v.name}}} is a link and can't go in the subject.`);
  }

  const paragraphs = body.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/).map((p) => p.trim());
  for (const p of paragraphs) {
    const only = p.match(/^\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}$/);
    for (const m of Array.from(p.matchAll(VAR_RE))) {
      const v = vars.get(m[1]);
      if (v?.kind === "block" && !only) errors.push(`{{${v.name}}} is a section: put it on its own, with a blank line before and after.`);
    }
    // Link variables must be used as the address of a link or button.
    const withoutLinks = p.replace(BUTTON_RE, "").replace(LINK_RE, "");
    for (const m of Array.from(withoutLinks.matchAll(VAR_RE))) {
      if (vars.get(m[1])?.kind === "link") errors.push(`{{${m[1]}}} is a link: use it as [link text]({{${m[1]}}}).`);
    }
    for (const re of [BUTTON_RE, LINK_RE]) {
      for (const m of Array.from(p.matchAll(re))) {
        const vm = m[2].match(/^\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/);
        if (vm && vars.get(vm[1]) && vars.get(vm[1])!.kind !== "link") errors.push(`{{${vm[1]}}} isn't a link, so it can't be a link's address.`);
      }
    }
  }

  for (const name of def.required || []) {
    const used = Array.from(body.matchAll(VAR_RE)).some((m) => m[1] === name);
    // ...and not on a line that's left out when an optional value is empty.
    for (const line of body.split("\n")) {
      const names = Array.from(line.matchAll(VAR_RE)).map((m) => m[1]);
      const optional = names.find((n) => vars.get(n)?.optional);
      if (names.includes(name) && optional) errors.push(`Put {{${name}}} on a different line from {{${optional}}}: that line is left out when {{${optional}}} is empty.`);
    }
    if (!used) {
      const v = vars.get(name);
      errors.push(
        v?.kind === "link"
          ? `This email must include the link {{${name}}} (for example [Click here]({{${name}}})). Without it the email doesn't work.`
          : `This email must include {{${name}}}. Without it the email doesn't work.`
      );
    }
  }
  return Array.from(new Set(errors));
}
