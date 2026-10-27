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
  // Only sent for orders from before the hourly redesign (Oct 2026), which
  // no longer exist: kept so that old code still works, but not listed in
  // Admin -> Emails.
  retired?: boolean;
  // Reminder emails sent by the daily cron (lib/scheduledEmails.ts) once
  // some time has passed. Admins switch them on and set the timing in
  // Admin -> Emails; `timing` is the standard timing, `when` explains what
  // starts the clock and what stops the reminders.
  schedule?: { timing: string; when: string };
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
  // Reminder: what's missing from a mentor's profile.
  missing: (items: { label: string; hint: string }[]) =>
    items.length ? `<ul>${items.map((i) => `<li><strong>${esc(i.label)}</strong>${i.hint ? `: ${esc(i.hint)}` : ""}</li>`).join("")}</ul>` : "",
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

const CALL_FOOTER = ">> Calls happen in a private MentorsMD video room. Calls may be recorded for safety and quality; only the mentor on the call and the MentorsMD team can watch a recording, and the team only looks if there's a problem with an order.";

// Every reminder email ends with this, so people can turn them off.
const STOP_LINE = ">> You're getting this reminder because you have a MentorsMD account. [Stop these reminders]({{stopLink}}). Emails about your orders, calls and messages still come.";
const stopLink = () => link("stopLink", "Link to stop reminder emails", `${SITE}/api/reminders/stop?u=sample&sig=sample`);

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
    retired: true,
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

  {
    key: "waitlist_mentors_available",
    name: "Waitlist: mentors are available",
    description: "Sent from Admin -> Leads -> Waitlist (\"Email everyone on the waitlist\") to people who asked to hear when mentors join. Includes a link to leave the waitlist.",
    group: "STUDENTS",
    subject: "Mentors are now available on MentorsMD",
    body: [
      "Hi there,",
      "You asked us to let you know when mentors join MentorsMD. They're here: medical students and residents, every one vetted by our senior team.",
      "You can message any mentor for free before you book.",
      "[[Browse mentors]]({{mentorsLink}})",
      ">> You're getting this because you joined the MentorsMD waitlist. [Remove me from the waitlist]({{removeLink}}).",
    ].join("\n\n"),
    vars: [
      link("mentorsLink", "Link to the mentors page", `${SITE}/mentors`),
      link("removeLink", "Link to leave the waitlist", `${SITE}/waitlist/remove?id=sample&sig=sample`),
    ],
    required: ["removeLink"],
  },
  {
    key: "contact_received",
    name: "Contact form: we got your message",
    description: "Sent to someone who uses the form on the Contact page, right after they send it. Replies go to the team inbox.",
    group: "BOTH",
    subject: "We got your message",
    body: [
      "Hi {{firstName}},",
      "Thanks for getting in touch with MentorsMD. A real person on our team will read your message and usually replies within one business day.",
      "> You can reply to this email to add anything.",
    ].join("\n\n"),
    // Their message is deliberately not repeated here, so the form can't
    // be used to send someone else's text to any address.
    vars: [V.firstName],
  },

  // ----- Reminders (students), sent by the daily cron -----
  {
    key: "reminder_abandoned_checkout",
    name: "Reminder: checkout not finished",
    description: "Sent to a student who started paying for a package, call or more hours with a mentor but didn't finish.",
    group: "STUDENTS",
    schedule: {
      timing: "After 1 day, then 3 days",
      when: "Counted from when they opened the payment page. Stops once they buy anything from that mentor, if the mentor stops taking orders, or if either of them blocked the other.",
    },
    subject: "Your {{packageTitle}} with {{mentorName}} is waiting",
    body: [
      "Hi {{firstName}},",
      "You started booking **{{packageTitle}}** with **{{mentorName}}** but didn't finish paying, so nothing was charged.",
      "If you'd still like to work with {{mentorName}}, you can pick up where you left off:",
      "[[Finish booking]]({{checkoutLink}})",
      "> Questions about a package or the price? You can message {{mentorName}} first, for free.",
      STOP_LINE,
    ].join("\n\n"),
    vars: [V.firstName, V.mentorName, V.packageTitle, link("checkoutLink", "Where to finish booking (the mentor's profile, or the package page for more hours)", `${SITE}/mentors/sample`), stopLink()],
    required: ["stopLink"],
  },
  {
    key: "reminder_no_contact",
    name: "Reminder: haven't contacted a mentor yet",
    description: "Sent to a student who confirmed their email but hasn't messaged a mentor, booked an intro call or bought anything.",
    group: "STUDENTS",
    schedule: {
      timing: "After 2 days, then 7 days",
      when: "Counted from when they signed up. Stops once they send a message, book an intro call or buy anything.",
    },
    subject: "Find your MentorsMD mentor",
    body: [
      "Hi {{firstName}},",
      "Thanks for joining MentorsMD. Our mentors are medical students and residents who've been through admissions, and every one is vetted by our senior team.",
      "You can message any mentor for free, or book a **free 15-minute intro call** to see if they're the right fit before you buy anything.",
      "[[Browse mentors]]({{mentorsLink}})",
      STOP_LINE,
    ].join("\n\n"),
    vars: [V.firstName, link("mentorsLink", "Link to the mentors page", `${SITE}/mentors`), stopLink()],
    required: ["stopLink"],
  },
  {
    key: "reminder_after_intro",
    name: "Reminder: after the intro call",
    description: "Sent to a student after their free intro call with a mentor was held, if they haven't bought anything from that mentor.",
    group: "STUDENTS",
    schedule: {
      timing: "After 2 days",
      when: "Counted from the end of the intro call. Stops once they buy anything from that mentor (or start paying: the checkout reminder takes over), if the mentor stops taking orders, or if either of them blocked the other.",
    },
    subject: "Ready to continue with {{mentorName}}?",
    body: [
      "Hi {{firstName}},",
      "Thanks for meeting **{{mentorName}}** for your intro call. If it felt like a good fit, you can now book hours or a package with them.",
      "[[See {{mentorName}}'s packages]]({{mentorLink}})",
      "> Not sure yet? Send {{mentorName}} a message with any questions, or meet another mentor.",
      STOP_LINE,
    ].join("\n\n"),
    vars: [V.firstName, V.mentorName, link("mentorLink", "Link to the mentor's profile", `${SITE}/mentors/sample`), stopLink()],
    required: ["stopLink"],
  },

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
    name: "New package (mentor)",
    description: "Sent to the mentor when a student pays for a package, hour bundle, hourly offer or pay-per-call.",
    group: "MENTORS",
    subject: "New package: {{packageTitle}}",
    body: [
      "**{{studentName}}** just bought **{{packageTitle}}** with you.",
      "Their hours are ready: they can book calls on your calendar, and you can log written work on the package page. You earn 70% of each hour, paid monthly on the 24th.",
      "[Open the package]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.studentName, V.packageTitle, V.orderLink],
  },
  {
    key: "payment_released",
    retired: true,
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
    retired: true,
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

  // ----- Reminders (mentors), sent by the daily cron -----
  {
    key: "reminder_mentor_profile",
    name: "Reminder: finish your profile",
    description: "Sent to a mentor whose profile isn't finished, so they're hidden from Browse mentors and students can't buy from them. Lists what's missing.",
    group: "MENTORS",
    schedule: {
      timing: "After 2 days, then 7 days",
      when: "Counted from when their mentor account was created. Stops once every section is filled in, or if their profile was removed or paused for review.",
    },
    subject: "Finish your MentorsMD profile so students can find you",
    body: [
      "Hi {{firstName}},",
      "Your mentor profile is almost there, but it's hidden from Browse mentors until every section is filled in. Still to do:",
      "{{missingList}}",
      "[[Finish my profile]]({{profileLink}})",
      STOP_LINE,
    ].join("\n\n"),
    vars: [
      V.firstName,
      block("missingList", "What's still missing (a list)", blocks.missing([{ label: "Bio", hint: "40 of 120 words" }, { label: "Fun fact", hint: "Add one or two sentences" }])),
      link("profileLink", "Link to the profile editor", `${SITE}/dashboard/profile`),
      stopLink(),
    ],
    required: ["stopLink"],
  },
  {
    key: "reminder_mentor_payouts",
    name: "Reminder: connect payouts",
    description: "Sent to a mentor whose profile is finished but who hasn't connected a bank account through Stripe, so students can't buy from them yet.",
    group: "MENTORS",
    schedule: {
      timing: "After 1 day, then 5 days",
      when: "Counted from when their profile was finished. Stops once Stripe says their account can be paid, or if their profile was removed or paused for review.",
    },
    subject: "Connect payouts so students can book you",
    body: [
      "Hi {{firstName}},",
      "Your profile is finished and students can find you on MentorsMD. One step left: connect your bank account through Stripe. Until then, students can't buy hours or packages from you.",
      "[[Set up payouts]]({{payoutsLink}})",
      "> It takes about 5 minutes. You're paid monthly on the 24th for the hours you've logged.",
      STOP_LINE,
    ].join("\n\n"),
    vars: [V.firstName, link("payoutsLink", "Link to the Payouts page", `${SITE}/dashboard/payouts`), stopLink()],
    required: ["stopLink"],
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
  // ----- Packages and hours (redesign Oct 2026) -----
  {
    key: "package_purchased",
    name: "Package bought (student)",
    description: "Sent to the student when a package, hour bundle, hourly offer or pay-per-call is paid for.",
    group: "STUDENTS",
    subject: "You're set: {{packageTitle}} with {{mentorName}}",
    body: [
      "Thanks for your purchase. **{{packageTitle}}** with **{{mentorName}}** is ready: {{hours}} at {{rate}} an hour.",
      "Paid: {{amount}}",
      "Credit applied: {{creditApplied}}",
      "Book 30- or 60-minute calls on your mentor's calendar, or send work for written feedback. Every call and every block of written work is logged on your package page, so you can always see your hours.",
      "[[Open your package]]({{orderLink}})",
      "> There's no due date. When your mentor marks the work complete, you'll have 48 hours to approve it or ask for one last call or revision. If you finish early, unused hours aren't refunded: packages are priced on an estimate, and mentors aren't penalised for working efficiently.",
    ].join("\n\n"),
    vars: [
      V.packageTitle,
      V.mentorName,
      text("hours", "Hours bought", "3 hours"),
      text("rate", "The per-hour rate", "$80"),
      text("amount", "The full price", "$240"),
      text("creditApplied", "MentorsMD credit used (the line is left out if none)", "$40", { optional: true }),
      V.orderLink,
    ],
  },
  {
    key: "hours_added",
    name: "Hours added",
    description: "Sent to the student when a top-up (Add hours) is paid and the hours are added to their package.",
    group: "STUDENTS",
    subject: "{{hours}} added to {{packageTitle}}",
    body: [
      "We've added **{{hours}}** to **{{packageTitle}}**. You now have {{hoursLeft}} left.",
      "Credit applied: {{creditApplied}}",
      "[Open your package]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.packageTitle, text("hours", "Hours added", "2 hours"), text("hoursLeft", "Hours left now", "3 hours"), text("creditApplied", "MentorsMD credit used (the line is left out if none)", "$40", { optional: true }), V.orderLink],
  },
  {
    key: "hours_low",
    name: "1 hour left",
    description: "Sent to the student once when a package gets down to 1 hour (or less) left.",
    group: "STUDENTS",
    subject: "{{hoursLeft}} left on {{packageTitle}}",
    body: [
      "You have **{{hoursLeft}}** left on **{{packageTitle}}** with {{mentorName}} (booked calls count as used).",
      "If you'd like more time, you can add hours at the same rate on your package page. Nothing to do otherwise.",
      "[Add hours]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.packageTitle, V.mentorName, text("hoursLeft", "Hours left", "1 hour"), V.orderLink],
  },
  {
    key: "more_hours_suggested",
    name: "Mentor suggests more hours",
    description: "Sent to the student when their mentor uses \"Suggest more hours\" on a package. The button opens Add hours with the suggested number picked.",
    group: "STUDENTS",
    subject: "{{mentorName}} suggests adding {{hours}} to {{packageTitle}}",
    body: [
      "{{mentorName}} suggests adding **{{hours}}** to **{{packageTitle}}**. You have {{hoursLeft}} left right now (booked calls count as used).",
      "{{note}}",
      "Adding hours is up to you, at the same rate. Nothing is charged unless you add them.",
      "[[Add hours]]({{addHoursLink}})",
    ].join("\n\n"),
    vars: [V.mentorName, V.packageTitle, text("hours", "Hours suggested", "3 hours"), text("hoursLeft", "Hours left now", "1 hour"), block("note", "The mentor's note (left out if none)", blocks.quote("The secondaries for your top three schools will take about three more hours.")), link("addHoursLink", "Link that opens Add hours with the suggested hours picked", `${SITE}/orders/sample-order?add_hours=3`)],
  },
  {
    key: "hours_low_mentor",
    name: "1 hour left (mentor)",
    description: "Sent to the mentor at the same time as the student's \"1 hour left\" email, so they know the package is nearly used up.",
    group: "MENTORS",
    subject: "{{studentName}} has {{hoursLeft}} left on {{packageTitle}}",
    body: [
      "**{{studentName}}** has **{{hoursLeft}}** left on **{{packageTitle}}** (booked calls count as used). We've emailed them a reminder that they can add hours at the same rate.",
      "If the work needs more time than that, use **Suggest more hours** on the package page: they get a message and a one-click button to add them.",
      "[Open the package]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.studentName, V.packageTitle, text("hoursLeft", "Hours left", "1 hour"), V.orderLink],
  },
  {
    key: "written_time_logged",
    name: "Written time logged",
    description: "Sent to the student when their mentor logs written work on their package.",
    group: "STUDENTS",
    subject: "{{mentorName}} logged {{minutes}} on {{packageTitle}}",
    body: [
      "{{mentorName}} logged **{{minutes}}** of written work on **{{packageTitle}}**.",
      "{{note}}",
      "You have {{hoursLeft}} left.",
      "[See the hours log]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.mentorName, V.packageTitle, text("minutes", "How long", "1 hour"), block("note", "The mentor's note", blocks.quote("Edited the second draft of your personal statement.")), text("hoursLeft", "Hours left", "2 hours"), V.orderLink],
  },
  {
    key: "work_marked_complete",
    name: "Work marked complete (student)",
    description: "Sent to the student when the mentor marks a package complete. Starts the 48-hour window.",
    group: "STUDENTS",
    subject: "{{mentorName}} marked {{packageTitle}} complete",
    body: [
      "{{mentorName}} marked **{{packageTitle}}** complete.",
      "You have **48 hours** (until {{deadline}}) to approve it, ask for one last call or one last revision, or open a dispute if something's wrong. If you don't respond, it's approved automatically.",
      "[[Review and respond]]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.mentorName, V.packageTitle, text("deadline", "When the 48 hours end (UTC)", "Oct 23, 4:00 PM UTC"), V.orderLink],
  },
  {
    key: "last_request",
    name: "One last call or revision requested",
    description: "Sent to the mentor when the student asks for one last call or one last revision after the work was marked complete.",
    group: "MENTORS",
    subject: "{{studentName}} asked for {{request}}",
    body: [
      "**{{studentName}}** asked for {{request}} on **{{packageTitle}}**.",
      "{{note}}",
      "When you've delivered it, mark the work complete again. They'll then have 48 hours to approve.",
      "[Open the package]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.studentName, text("request", '"one last call" or "one last revision"', "one last revision"), V.packageTitle, block("note", "What the student asked for", blocks.quote("Could you look at the conclusion once more?")), V.orderLink],
  },
  {
    key: "package_approved",
    name: "Package approved",
    description: "Sent to the student and the mentor when a package is approved, by the student or automatically after 48 hours.",
    group: "BOTH",
    subject: "{{packageTitle}} is approved",
    body: [
      "**{{packageTitle}}** ({{studentName}} with {{mentorName}}) was {{how}}.",
      "{{mentorLine}}",
      "[Open the package]({{orderLink}})",
    ].join("\n\n"),
    vars: [
      V.packageTitle,
      V.studentName,
      V.mentorName,
      text("how", '"approved" or "approved automatically after 48 hours"', "approved"),
      text("mentorLine", "Mentors only: when they're paid (left out for the student)", "Your earnings for it, including any unused hours, are paid with the monthly payout on the 24th.", { optional: true }),
      V.orderLink,
    ],
  },
  {
    key: "call_time_taken",
    name: "Pick another call time",
    description: "Sent to the student when they paid for a call but the time they picked was booked by someone else meanwhile.",
    group: "STUDENTS",
    subject: "Please pick another time for your call with {{mentorName}}",
    body: [
      "Your payment for **{{packageTitle}}** went through, but the time you picked was taken while you were paying.",
      "Your call is paid for and waiting: please pick another time on your package page.",
      "[[Pick a new time]]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.mentorName, V.packageTitle, V.orderLink],
  },
  // ----- Monthly payouts and MentorsMD credit (redesign Oct 2026) -----
  {
    key: "payout_sent",
    name: "Monthly payout sent",
    description: "Sent to the mentor on the 24th when their monthly payout is sent to their bank through Stripe.",
    group: "MENTORS",
    subject: "Your MentorsMD payout for {{period}}: {{amount}}",
    body: [
      "Hi {{firstName}},",
      "Your monthly payout of **{{amount}}** is on its way to your bank account through Stripe.",
      "It covers {{hours}} of mentoring: calls held and written work logged since your last payout, plus the unused hours of packages approved by now.",
      "Held back: {{heldNote}}",
      "[[See your earnings]]({{dashboardLink}})",
      "> Stripe usually takes 2 to 7 business days to reach your bank, depending on your bank and country. You earn 70% of each hour; MentorsMD keeps 30%.",
    ].join("\n\n"),
    vars: [
      V.firstName,
      text("period", 'The payout month, e.g. "October 2026"', "October 2026"),
      text("amount", "What the mentor receives", "$560.00"),
      text("hours", "Hours paid in this payout", "8 hours"),
      text("heldNote", "Hours held back by an open dispute (the line is left out if none)", "$70.00 on a package with an open dispute, paid once it's decided.", { optional: true }),
      link("dashboardLink", "Link to the mentor's dashboard", `${SITE}/dashboard`),
    ],
  },
  {
    key: "credit_issued",
    name: "MentorsMD credit added",
    description: "Sent to the student when MentorsMD credit is added to their account: a dispute refunded as credit, or an adjustment by the team.",
    group: "STUDENTS",
    subject: "{{amount}} of MentorsMD credit added to your account",
    body: [
      "Hi {{firstName}},",
      "We've added **{{amount}}** of MentorsMD credit to your account{{forPackage}}.",
      "{{note}}",
      "Your credit balance is now **{{balance}}**. Credit never expires and you can use it with any mentor: it's applied automatically at checkout. [See your credit history]({{creditLink}}).",
      "[[Find a mentor]]({{mentorsLink}})",
    ].join("\n\n"),
    vars: [
      V.firstName,
      text("amount", "How much credit was added", "$80.00"),
      text("forPackage", 'Says " for <package title>" when it\'s about a package; empty otherwise', " for Personal statement review"),
      block("note", "A note from the team (left out if there's none)", blocks.quote("Refunded as credit to settle your dispute.")),
      text("balance", "The student's credit balance now", "$120.00"),
      link("mentorsLink", "Link to Browse mentors", `${SITE}/mentors`),
      link("creditLink", "Link to the student's MentorsMD credit page", `${SITE}/credit`),
    ],
  },
  // ----- Gifts from a parent (lib/gifts.ts) -----
  {
    key: "gift_received",
    name: "Gift received",
    description: "Sent to the student when a parent or guardian buys them MentorsMD credit or a package on the Gift page. A new account gets a link to set a password; an existing account gets a link to log in.",
    group: "STUDENTS",
    subject: "{{parentName}} sent you {{giftShort}} on MentorsMD",
    body: [
      "Hi {{firstName}},",
      "**{{parentName}}** sent you **{{giftLine}}** on MentorsMD.",
      "{{note}}",
      "MentorsMD connects you with medical students and doctors who help with every part of getting into medical school. Credit never expires and you can use it with any mentor.",
      "[[Set up your account]]({{claimLink}})",
      "[[Log in to MentorsMD]]({{loginLink}})",
      "> {{claimHelp}}",
    ].join("\n\n"),
    vars: [
      V.firstName,
      text("parentName", "The name of the parent or guardian who paid", "Maria Lee"),
      text("giftShort", 'Short version for the subject, e.g. "$100 of credit"', "$100.00 of credit"),
      text("giftLine", "What was bought", "$100.00 of MentorsMD credit"),
      block("note", "The parent's personal note (left out if there's none)", blocks.quote("Good luck this cycle! Love, Mom")),
      link("claimLink", "Set-a-password link, for a new account (the line is left out for existing accounts)", `${SITE}/gift/claim?token=sample`, { optional: true }),
      link("loginLink", "Login link, for an existing account (the line is left out for new accounts)", `${SITE}/login`, { optional: true }),
      text("claimHelp", "How long the set-up link works (left out for existing accounts)", "This link works for 60 days. After that, use Forgot password on the login page.", { optional: true }),
    ],
  },
  // ----- Free intro calls (redesign Oct 2026) -----
  {
    key: "intro_call_booked",
    name: "Intro call booked",
    description: "Sent to the student and mentor when a free 15-minute intro call is booked, with a calendar invite attached.",
    group: "BOTH",
    subject: "Intro call booked with {{otherName}}",
    body: [
      "Your free 15-minute intro call with **{{otherName}}** is set for:",
      "## **{{when}}**",
      "Join from [your call page]({{joinLink}}). The Join button opens 10 minutes before the start. The attached invite adds it to your calendar.",
      "It's a chance to say hello, talk through where you are and see if you're a good fit. There's nothing to pay.",
      "Need to change it? You can cancel from [your messages]({{manageLink}}) up to 24 hours before the call, then book a new time.",
      CALL_FOOTER,
    ].join("\n\n"),
    vars: [V.otherName, V.when, V.joinLink, link("manageLink", "Link to the conversation, where the call can be cancelled", `${SITE}/messages/sample-conversation`)],
  },
  {
    key: "intro_call_cancelled",
    name: "Intro call cancelled",
    description: "Sent to the student and mentor when a free intro call is cancelled; removes it from their calendar.",
    group: "BOTH",
    subject: "Intro call cancelled",
    body: [
      "{{cancelledBy}} cancelled the free intro call with {{otherName}} that was set for {{when}}.",
      "The student can book a new time from the mentor's profile.",
      "[Open your messages]({{manageLink}})",
    ].join("\n\n"),
    vars: [text("cancelledBy", "Who cancelled", "Priya Shah"), V.otherName, V.when, link("manageLink", "Link to the conversation", `${SITE}/messages/sample-conversation`)],
  },
  {
    key: "intro_call_reminder",
    name: "Intro call reminder",
    description: "Sent at 8am (recipient's time) on the day of a free intro call, and about an hour before it, to the student and mentor.",
    group: "BOTH",
    subject: "{{soon}}: your intro call with {{otherName}}",
    body: [
      "Just a reminder: your free 15-minute intro call with **{{otherName}}** is {{soonLower}}.",
      "{{when}}",
      "[[Join the call]]({{joinLink}})",
      "> The Join button works from 10 minutes before the start. Use a quiet spot and allow camera and microphone access when your browser asks.",
      CALL_FOOTER,
    ].join("\n\n"),
    vars: [
      text("soon", 'When it is: "Today" or "Starting in 1 hour"', "Today"),
      text("soonLower", 'The same in a sentence: "today" or "in about an hour"', "today"),
      V.otherName,
      V.when,
      V.joinLink,
    ],
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
    key: "call_student_no_show_student",
    name: "Missed call (student didn't join), to the student",
    description: "Sent to the student when their mentor joined a call and the student hadn't joined 15 minutes after the start. The call counts as used.",
    group: "STUDENTS",
    subject: "You missed your call: {{packageTitle}}",
    body: [
      "Your call with **{{otherName}}** for **{{packageTitle}}** was set for {{when}}.",
      "{{otherName}} joined, but you hadn't joined 15 minutes after the start, so this call counts as used.",
      "If something went wrong (for example a technical problem), reply to your mentor on the order page or contact us.",
      "[View the order]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.otherName, V.packageTitle, V.when, V.orderLink],
  },
  {
    key: "call_student_no_show_mentor",
    name: "Missed call (student didn't join), to the mentor",
    description: "Sent to the mentor when they joined a call and the student hadn't joined 15 minutes after the start. The call counts as used.",
    group: "MENTORS",
    subject: "{{otherName}} didn't join the call: {{packageTitle}}",
    body: [
      "Thanks for joining your call with **{{otherName}}** for **{{packageTitle}}** ({{when}}).",
      "{{otherName}} hadn't joined 15 minutes after the start, so the call counts as used.",
      "**Please send {{otherName}} a message** on MentorsMD so there's a record, then carry on with the order.",
      "[Open the order]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.otherName, V.packageTitle, V.when, V.orderLink],
  },
  {
    key: "call_mentor_no_show_student",
    name: "Missed call (mentor didn't join), to the student",
    description: "Sent to the student when they joined a call and the mentor wasn't there 15 minutes after the start. The student can book another call for free; after a second missed call they can open a dispute for a full refund.",
    group: "STUDENTS",
    subject: "Your mentor missed your call: {{packageTitle}}",
    body: [
      "We're sorry: **{{otherName}}** didn't join your call for **{{packageTitle}}** ({{when}}).",
      "This call doesn't count toward your package, so **you can book another one for free** on the order page.",
      "**{{secondMissed}}.** You can open a dispute on the order page, and a full refund is the expected outcome.",
      "[[Go to the order]]({{orderLink}})",
    ].join("\n\n"),
    vars: [
      V.otherName, V.packageTitle, V.when,
      text("secondMissed", 'Says "This is the second call your mentor has missed on this order"; empty (and the line left out) the first time', "This is the second call your mentor has missed on this order", { optional: true }),
      V.orderLink,
    ],
  },
  {
    key: "call_mentor_no_show_mentor",
    name: "Missed call (mentor didn't join), to the mentor",
    description: "Sent to the mentor when the student joined a call and the mentor wasn't there 15 minutes after the start. The student can book another call for free.",
    group: "MENTORS",
    subject: "You missed your call with {{otherName}}",
    body: [
      "Our records show you didn't join your call with **{{otherName}}** for **{{packageTitle}}** ({{when}}), or joined more than 15 minutes late.",
      "The call doesn't count toward the package, so {{otherName}} can book another one for free. Please message them to apologise and help them rebook.",
      "**{{secondMissed}}.** {{otherName}} can now open a dispute, and a full refund is the expected outcome.",
      "If this is wrong (for example you were there but had a technical problem), contact us.",
      "[Open the order]({{orderLink}})",
    ].join("\n\n"),
    vars: [
      V.otherName, V.packageTitle, V.when,
      text("secondMissed", 'Says "This is the second call missed on this order"; empty (and the line left out) the first time', "This is the second call missed on this order", { optional: true }),
      V.orderLink,
    ],
  },
  {
    key: "call_nobody_joined",
    name: "Nobody joined the call",
    description: "Sent to the student and mentor when neither of them joined a call (or it's unclear what happened). It doesn't count either way until an admin decides.",
    group: "BOTH",
    subject: "About your call: {{packageTitle}}",
    body: [
      "Your call with **{{otherName}}** for **{{packageTitle}}** was set for {{when}}, but our records don't show the call taking place.",
      "It doesn't count either way for now. Someone from the MentorsMD team will be in touch to sort it out.",
      "[View the order]({{orderLink}})",
    ].join("\n\n"),
    vars: [V.otherName, V.packageTitle, V.when, V.orderLink],
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
      "**Package:** {{packageTitle}}\n**Mentor:** {{mentorName}}\n**Amount paid:** {{amount}}\n**Date:** {{paidOn}}",
      "Every call and block of written work is logged on the package, and you can see it all from the link below.",
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

  {
    key: "gift_receipt",
    name: "Gift receipt (parent)",
    description: "Sent to the parent or guardian who bought a gift on the Gift page, once the payment clears: what they bought, and their private gift page.",
    group: "PARENTS",
    subject: "Receipt: your gift to {{studentName}}",
    body: [
      "Hi {{parentFirstName}},",
      "Thank you. Your gift to **{{studentName}}** is paid, and we've emailed {{studentFirstName}} to let them know.",
      "**Gift:** {{giftLine}}\n**Amount paid:** {{amount}}\n**Date:** {{paidOn}}",
      "{{consentNote}}",
      "You can see what you bought, and for a package the hours used and calls held, on your private gift page. Stripe also emails you its own card receipt.",
      "[[Open your gift page]]({{giftLink}})",
      "> Keep this link private: anyone with it can see this gift. It doesn't show any messages.",
    ].join("\n\n"),
    vars: [
      text("parentFirstName", "The parent's first name", "Maria"),
      V.studentName,
      text("studentFirstName", "The student's first name", "Jordan"),
      text("giftLine", "What was bought", "Personal statement review (5 hours) with Dr. Priya Shah"),
      text("amount", "Amount paid", "$400.00"),
      text("paidOn", "Date paid", "Tue Oct 27 2026"),
      text("consentNote", "For students under 18: consent is asked separately (left out otherwise)", "Because Jordan is under 18, they'll need your consent before they can use MentorsMD. That's a separate email we send you once they set up their account.", { optional: true }),
      link("giftLink", "The parent's private gift page", `${SITE}/gift/sample-link`),
    ],
    required: ["giftLink"],
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
    key: "contact_message",
    name: "New contact message",
    description: "Sent to the team inbox when someone uses the form on the Contact page. Reply goes to the sender.",
    group: "TEAM",
    subject: "Contact form ({{topic}}): {{senderName}}",
    body: [
      "**New message from the Contact page**",
      "**Name:** {{senderName}}\n**Email:** {{senderEmail}}\n**Topic:** {{topic}}",
      "{{message}}",
      "[Open it in Admin → Leads]({{adminLink}}). Reply to this email to answer {{senderName}} directly.",
    ].join("\n\n"),
    vars: [
      text("senderName", "The sender's name", "Jordan Lee"),
      text("senderEmail", "The sender's email", "jordan@example.com"),
      text("topic", "The topic they picked", "Student question"),
      block("message", "What they wrote", blocks.quote("Hi! How do I pick the right mentor for my secondaries?")),
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
    key: "login_code",
    name: "Login code (mentors and students)",
    description: "The 6-digit 2-step login code. Mentors always get one (unless they use an authenticator app or trusted this device); students only if they turned 2-step on in Settings.",
    group: "BOTH",
    subject: "Your MentorsMD login code: {{code}}",
    body: [
      "Your MentorsMD login code is:",
      "# **{{code}}**",
      "> It expires in 10 minutes. If you didn't just try to log in, change your password right away.",
    ].join("\n\n"),
    vars: [text("code", "The 6-digit code", "123456")],
    required: ["code"],
  },
  {
    key: "two_step_changed",
    name: "2-step method changed (mentors and students)",
    description: "A security notice whenever someone's 2-step verification changes in Settings: switched to an authenticator app or to email codes, turned on, or turned off.",
    group: "BOTH",
    subject: "Your MentorsMD 2-step verification changed",
    body: [
      "Hi {{firstName}},",
      "The 2-step verification on your MentorsMD account just changed: **{{change}}**.",
      "> If this wasn't you, reset your password right away and contact the MentorsMD team.",
      "[Go to MentorsMD]({{siteLink}})",
    ].join("\n\n"),
    vars: [V.firstName, text("change", "What changed", "it now uses an authenticator app"), V.siteLink],
    required: ["change"],
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
export const EMAIL_LIST: EmailDef[] = LIST.filter((d) => !d.retired);
export type EmailKey = string;

// ---- Reminder timing ("After 1 day, then 3 days") ----
// Plain words an admin types in Admin -> Emails. Each number is one
// reminder, counted from the same starting point (not from the previous
// reminder). A number without "hour" or "day" uses the one before it, so
// "After 1 day, then 3" means 1 day and 3 days. Hours are allowed for
// short waits ("After 4 hours, then 2 days").
export const TIMING_MAX_STEPS = 4;
export const TIMING_MIN_HOURS = 2;
export const TIMING_MAX_DAYS = 60;

export function parseTiming(timing: string): { hours: number[]; error: string | null } {
  const hours: number[] = [];
  let unit = "day";
  for (const m of Array.from(String(timing || "").toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|days?|d\b|weeks?|w\b)?/g))) {
    if (m[2]) unit = m[2].startsWith("h") ? "hour" : m[2].startsWith("w") ? "week" : "day";
    const n = Number(m[1]);
    hours.push(Math.round(n * (unit === "hour" ? 1 : unit === "week" ? 168 : 24)));
  }
  if (!hours.length) return { hours, error: 'Write when to send it, for example "After 1 day, then 3 days".' };
  if (hours.length > TIMING_MAX_STEPS) return { hours, error: `At most ${TIMING_MAX_STEPS} reminders.` };
  if (hours.some((h) => h < TIMING_MIN_HOURS)) return { hours, error: `The first reminder can't be sooner than ${TIMING_MIN_HOURS} hours.` };
  if (hours.some((h) => h > TIMING_MAX_DAYS * 24)) return { hours, error: `Each reminder must be within ${TIMING_MAX_DAYS} days.` };
  if (hours.some((h, i) => i > 0 && h <= hours[i - 1])) return { hours, error: "Each reminder must come later than the one before it." };
  return { hours, error: null };
}

// "1 day", "3 days", "4 hours": for the Outbox and the editor.
export function waitLabel(hours: number) {
  if (hours % 24 === 0) return `${hours / 24} day${hours === 24 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

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
