import type { Prisma } from "@prisma/client";

// Who shows up in browse, on the homepage and can be booked.
//   ACTIVE                              -> visible
//   PAUSED with a return date in the past -> visible again (auto-resume)
//   PAUSED otherwise, or REMOVED         -> hidden
export function visibleMentorWhere(now: Date = new Date()): Prisma.UserWhereInput {
  return {
    role: "SELLER",
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

// A package only appears in search once the mentor has answered every
// required search question - on the package and on their profile.
export const searchableGigWhere: Prisma.GigWhereInput = {
  active: true,
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
  format: string | null;
  turnaround: string | null;
  callsIncluded: number;
  callLength: number | null;
}) {
  const missing: string[] = [];
  if (!g.service) missing.push("Service");
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
