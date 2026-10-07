import type { Prisma } from "@prisma/client";
import { PRICE_MAX_CENTS, PRICE_MIN_CENTS, isPriceInRange } from "@/lib/options";

// Who shows up in browse, on the homepage and can be booked.
//   ACTIVE                              -> visible
//   PAUSED with a return date in the past -> visible again (auto-resume)
//   PAUSED otherwise, or REMOVED         -> hidden
export function visibleMentorWhere(now: Date = new Date()): Prisma.UserWhereInput {
  return {
    role: "SELLER",
    safetyHoldAt: null, // paused by MentorsMD pending a safety review
    OR: [{ profileStatus: "ACTIVE" }, { profileStatus: "PAUSED", pausedUntil: { lte: now } }],
  };
}

export function isMentorVisible(
  u: { profileStatus: string; pausedUntil: Date | null },
  now: Date = new Date()
) {
  if (u.profileStatus === "ACTIVE") return true;
  if (u.profileStatus === "PAUSED" && u.pausedUntil && u.pausedUntil <= now) return true;
  return false;
}

// Packages students can see and book: active and priced inside the
// current limits. Packages priced outside the limits (made before they
// changed) stay hidden until the mentor updates the price.
export const bookableGigWhere: Prisma.GigWhereInput = {
  active: true,
  price: { gte: PRICE_MIN_CENTS, lte: PRICE_MAX_CENTS },
};

// A package only appears in search once the mentor has answered every
// required search question - on the package and on their profile.
export const searchableGigWhere: Prisma.GigWhereInput = {
  ...bookableGigWhere,
  service: { not: null },
  format: { not: null },
  turnaround: { not: null },
};

export const searchableSellerWhere: Prisma.UserWhereInput = {
  mentorStage: { not: null },
  schoolType: { not: null },
};

export function missingGigAnswers(g: {
  service: string | null;
  serviceOther?: string | null;
  format: string | null;
  turnaround: string | null;
  callsIncluded: number;
  callLength: number | null;
}) {
  const missing: string[] = [];
  if (!g.service) missing.push("Service");
  if (g.service === "OTHER" && !g.serviceOther) missing.push("Service name");
  if (!g.format) missing.push("Format");
  if (!g.turnaround) missing.push("Turnaround");
  if ((g.format === "WRITTEN_CALL" || g.format === "LIVE") && (!g.callsIncluded || !g.callLength)) {
    missing.push("Calls included & call length");
  }
  return missing;
}

export function missingMentorAnswers(u: { mentorStage: string | null; schoolType: string | null }) {
  const missing: string[] = [];
  if (!u.mentorStage) missing.push("Your stage");
  if (!u.schoolType) missing.push("School type");
  return missing;
}

export function gigPriceOutOfRange(g: { price: number }) {
  return !isPriceInRange(g.price);
}
