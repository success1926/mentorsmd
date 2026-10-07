// The mentor agreement, accepted at mentor signup and again whenever a
// mentor publishes or saves a package. Change the date in the version
// (and the wording) when the agreement changes; the version each mentor
// accepted is stored with the date they accepted it.
export const MENTOR_AGREEMENT_VERSION = "2026-10-07";

export const MENTOR_AGREEMENT_POINTS = [
  "I give feedback and guidance. I never write essays, statements or applications for students, and I never take tests for them.",
  "I keep all payments, calls and file sharing on MentorsMD. I don't share my phone number, email or payment apps with students.",
  "I never ask for or accept passwords or login details (AMCAS, AACOMAS, TMDSAS, email or anything else).",
  "I deliver what my package describes by the due date, and reply to messages within 24 hours.",
  "I follow the Community Guidelines and treat every student with respect.",
];

export function acceptedAgreement(value: unknown): boolean {
  return value === true || value === MENTOR_AGREEMENT_VERSION;
}
