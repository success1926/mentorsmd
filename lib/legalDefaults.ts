import { MENTOR_AGREEMENT_POINTS } from "@/lib/agreement";
import type { LegalKind } from "@/lib/legalKinds";

// The built-in text shown for a document before any version of it is
// published in Admin -> Legal ("version 0"). Terms, Privacy and the
// Community Guidelines keep their existing pages until then; these two
// documents had no page of their own.
//
// Placeholder wording: have a lawyer review it, then publish the real
// version from Admin -> Legal.

export const DEFAULT_LEGAL_TEXT: Partial<Record<LegalKind, { title: string; body: string }>> = {
  MENTOR_AGREEMENT: {
    title: "Mentor Agreement",
    body: [
      "Every mentor on MentorsMD agrees to the following when they join and each time they publish a package.",
      "",
      ...MENTOR_AGREEMENT_POINTS.map((p) => `- ${p}`),
    ].join("\n"),
  },
  PARENTAL_CONSENT: {
    title: "Parental Consent form",
    body: [
      "MentorsMD connects students applying to medical school with mentors (medical students and residents) who are vetted by our senior team. Students aged 13 to 17 need a parent or legal guardian's consent before they can use the site.",
      "",
      "## What your student can do on MentorsMD",
      "- Message mentors through MentorsMD messages. Conversations are checked automatically for safety, and our team may read them if something is flagged.",
      "- Book paid packages (written feedback and/or video calls). Payment is held until your student approves the work.",
      "- Join video calls in a private MentorsMD room. Calls may be recorded for safety and are only watched by our team if there is a problem.",
      "",
      "## How we protect students under 18",
      "- Mentors can see that a student is under 18, and mentors may choose not to work with students under 18.",
      "- Sharing phone numbers, emails, social media or outside meeting links with a student under 18 is treated as a high-severity safety issue and reviewed by our team.",
      "- You receive a receipt by email for every order, and a private link to see your student's orders and calls.",
      "",
      "## Your choices",
      "- You can withdraw your consent at any time from your private parent link. Your student's account is then paused, and our team will contact you about any open orders.",
      "- When your student turns 18, their account becomes a regular account and your parent link stops working.",
      "",
      "By typing your full name below you confirm that you are this student's parent or legal guardian, that you have read the Terms of Service and this form, and that you consent to your student using MentorsMD.",
    ].join("\n"),
  },
};
