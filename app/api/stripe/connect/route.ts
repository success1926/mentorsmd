import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/siteUrl";
import { getSession } from "@/lib/session";

// Called when a seller clicks "Connect bank account" in their dashboard.
// Creates a connected Stripe account (if they don't have one yet) and
// returns a one-time hosted onboarding URL. Stripe collects the bank
// details, identity docs, and tax info directly - none of it ever
// touches our database or servers.
//
// This uses Stripe's v2 Core Accounts API directly (raw HTTP calls, not
// the stripe-node SDK's older v1 methods) because new Stripe accounts no
// longer get v1 Account creation access by default - Stripe is steering
// new integrations onto v2. The "recipient" configuration below is
// exactly what a payout-only seller needs: the ability to receive
// Transfers from us, nothing about accepting their own separate
// payments. Once created, this account still works as the `destination`
// on a normal Transfer (see lib/payouts.ts) - that part of Stripe's
// API didn't change.
const STRIPE_API_BASE = "https://api.stripe.com/v2/core";
const STRIPE_VERSION = "2026-08-26.preview";

async function stripeV2Request(path: string, body: object) {
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Stripe-Version": STRIPE_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Stripe request to ${path} failed`);
  }
  return data;
}

export async function POST() {
  const session = await getSession();
  if (!session?.user || (session.user as any).role !== "SELLER") {
    return NextResponse.json({ error: "Only mentor accounts can connect payouts" }, { status: 403 });
  }

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let accountId = user.stripeAccountId;

  try {
    if (!accountId) {
      // One account per mentor: a double click waits here, then finds the
      // account the first click made instead of making a second one.
      accountId = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"stripe-connect:" + userId}))`;
          const fresh = await tx.user.findUnique({ where: { id: userId }, select: { stripeAccountId: true } });
          if (fresh?.stripeAccountId) return fresh.stripeAccountId;
          const account = await stripeV2Request("/accounts", {
            contact_email: user.email,
            display_name: user.name,
            dashboard: "express",
            identity: { country: "us" },
            // Required by Stripe's v2 API whenever an account can receive
            // Transfers: who's on the hook for processing fees and any
            // losses (like chargebacks) on this account. As the platform,
            // that's us ("application"), not Stripe.
            defaults: {
              responsibilities: {
                fees_collector: "application",
                losses_collector: "application",
              },
            },
            configuration: {
              recipient: {
                capabilities: {
                  stripe_balance: { stripe_transfers: { requested: true } },
                },
              },
            },
            include: ["configuration.recipient", "identity", "requirements"],
          });
          await tx.user.update({ where: { id: userId }, data: { stripeAccountId: account.id } });
          return account.id as string;
        },
        { timeout: 30_000, maxWait: 30_000 }
      );
    }

    const accountLink = await stripeV2Request("/account_links", {
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: `${siteUrl()}/dashboard/payouts?refresh=true`,
          return_url: `${siteUrl()}/dashboard/payouts?connected=true`,
        },
      },
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    console.error("Stripe Connect onboarding failed:", err);
    return NextResponse.json({ error: err.message || "Couldn't start payout setup" }, { status: 500 });
  }
}
