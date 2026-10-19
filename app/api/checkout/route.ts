import { NextResponse } from "next/server";

// The old one-package checkout (a fixed price and a due date) was replaced
// by hourly pricing in Oct 2026: packages, hour bundles, hourly and
// pay-per-call are bought from the mentor's profile (/api/offers/... ->
// lib/hourCheckout.ts). Kept so an old page or bookmark gets a clear answer.
export async function POST() {
  return NextResponse.json({ error: "Packages are now bought from the mentor's profile. Refresh the page and try again." }, { status: 410 });
}
