// Is a mentor's Stripe account actually ready to be paid? Having a
// stripeAccountId isn't enough: it's saved before the mentor is sent to
// Stripe's form, so someone who leaves halfway still has one. Asks Stripe
// (v2 Accounts) directly. Server only.
const STRIPE_VERSION = "2026-08-26.preview";

export type PayoutAccountStatus = {
  ready: boolean;
  // Stripe's own status of the "receive transfers" capability, when given.
  transfers: string | null;
  outstandingItems: string[];
  error?: string;
};

export async function payoutAccountStatus(accountId: string): Promise<PayoutAccountStatus> {
  const url = `https://api.stripe.com/v2/core/accounts/${encodeURIComponent(accountId)}?include=requirements&include=configuration.recipient&include=identity`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Stripe-Version": STRIPE_VERSION },
    cache: "no-store",
  });
  const account = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Stripe account lookup failed:", account);
    return { ready: false, transfers: null, outstandingItems: [], error: account?.error?.message || "Couldn't check status" };
  }

  // Requirements blocking now. v2 puts the status either on the entry or
  // under minimum_deadline; both are checked.
  const entries: any[] = account.requirements?.entries || [];
  const blocking = ["currently_due", "past_due"];
  const outstandingItems = entries
    .filter((e) => blocking.includes(e?.status) || blocking.includes(e?.minimum_deadline?.status))
    .map((e) => e.requirement || e.field || e.description || e.reason || "A detail on your Stripe account");

  // The real test: can this account receive transfers?
  const transfers: string | null = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ?? null;
  const ready = transfers ? transfers === "active" : outstandingItems.length === 0;
  return { ready, transfers, outstandingItems };
}

// For checkout and payouts: true only when Stripe says the account can be
// paid. A failed lookup counts as not ready (nothing is charged or sent).
export async function payoutsReady(accountId: string | null | undefined): Promise<boolean> {
  if (!accountId) return false;
  try {
    return (await payoutAccountStatus(accountId)).ready;
  } catch (err) {
    console.error("Stripe account check failed", accountId, err);
    return false;
  }
}
