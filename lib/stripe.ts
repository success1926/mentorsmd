import Stripe from "stripe";

// Lazy-initialized on purpose: the old version threw immediately if
// STRIPE_SECRET_KEY was missing, which crashed the ENTIRE app on
// startup - even pages that have nothing to do with payments, like just
// browsing coaches. This version only throws when something actually
// tries to use Stripe, so you can get the rest of the site running
// while you're still setting up your Stripe account.
let _stripe: Stripe | null = null;

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error(
          "STRIPE_SECRET_KEY is not set - add it to .env to use payment features (checkout, payouts, refunds)."
        );
      }
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    }
    return (_stripe as any)[prop];
  },
});

// Your platform's cut. Kept in one place so it's never hardcoded twice.
export const PLATFORM_FEE_PERCENT = 20;
