import { prisma } from "@/lib/prisma";
import { pendingLegal, type PendingDoc } from "@/lib/legal";

// What a student or mentor must do before using MentorsMD (shown as the
// blocking screen in components/AccountGate.tsx, and enforced by the
// message, conversation and checkout routes):
//   1. Students: give a date of birth (#104; asked once of students who
//      signed up before it was required).
//   2. Accept new versions of the legal documents (#101, #103).
//   3. Students aged 13-17: wait for a parent or guardian's consent (#107).

export type GateStatus = {
  needsDob: boolean;
  legal: PendingDoc[];
  minor: null | {
    status: string; // PENDING, CONSENTED, WITHDRAWN
    parentName: string | null;
    parentEmail: string | null;
    requestStatus: string | null; // the latest request: PENDING, EXPIRED, DECLINED, WITHDRAWN...
    expiresAt: Date | null;
    lastSentAt: Date | null;
  };
  blocked: boolean;
};

export async function accountGate(userId: string): Promise<GateStatus | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, dateOfBirth: true, minorStatus: true } });
  if (!user) return null;
  if (user.role !== "BUYER" && user.role !== "SELLER") return { needsDob: false, legal: [], minor: null, blocked: false };

  const needsDob = user.role === "BUYER" && !user.dateOfBirth;
  const legal = await pendingLegal(user);
  let minor: GateStatus["minor"] = null;
  if (user.role === "BUYER" && user.minorStatus) {
    const latest = await prisma.parentConsent.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
    minor = {
      status: user.minorStatus,
      parentName: latest?.parentName ?? null,
      parentEmail: latest?.parentEmail ?? null,
      requestStatus: latest ? (latest.status === "PENDING" && latest.expiresAt < new Date() ? "EXPIRED" : latest.status) : null,
      expiresAt: latest?.expiresAt ?? null,
      lastSentAt: latest?.lastSentAt ?? null,
    };
  }
  const blocked = needsDob || legal.length > 0 || (!!minor && minor.status !== "CONSENTED");
  return { needsDob, legal, minor, blocked };
}

// For API routes: a short reason this account can't message or book yet, or null.
export async function gateBlockReason(userId: string): Promise<string | null> {
  try {
    const g = await accountGate(userId);
    if (!g || !g.blocked) return null;
    if (g.needsDob) return "Please add your date of birth first (reload the page to see the form).";
    if (g.legal.length) return `Please review and accept the updated ${g.legal.map((d) => d.label).join(", ")} first (reload the page).`;
    if (g.minor?.status === "WITHDRAWN") return "Your account is paused because your parent or guardian didn't give, or withdrew, consent.";
    return "Your account is waiting for your parent or guardian's consent. We emailed them a link.";
  } catch (err) {
    // Never lock everyone out because of a database hiccup here.
    console.error("Couldn't check the account gate:", err);
    return null;
  }
}
