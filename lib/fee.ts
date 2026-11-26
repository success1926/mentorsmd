// MentorsMD's cut of each order, in percent. The mentor gets the rest.
// Kept in its own file with no imports so client pages can use it too.
export const PLATFORM_FEE_PERCENT = 30;

// MentorsMD's fee and the mentor's share of an amount, in cents. Payouts use
// exactly these, so every "earned" figure on a page matches what is paid.
export const feeOf = (grossCents: number) => Math.round((grossCents * PLATFORM_FEE_PERCENT) / 100);
export const mentorShare = (grossCents: number) => grossCents - feeOf(grossCents);
