// MentorsMD's cut of each order, in percent. The mentor gets the rest.
// MUST match the website's lib/fee.ts exactly, so every "earned" figure in
// the app is what the mentor is really paid.
export const PLATFORM_FEE_PERCENT = 30;

// MentorsMD's fee and the mentor's share of an amount, in cents.
export const feeOf = (grossCents: number) => Math.round((grossCents * PLATFORM_FEE_PERCENT) / 100);
export const mentorShare = (grossCents: number) => grossCents - feeOf(grossCents);
