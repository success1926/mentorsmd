import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_LABEL, activeOwnerCount, currentAdmin, normalizeAdminRole, revokeSessions } from "@/lib/adminTeam";
import { sendTeamAccessChangedEmail } from "@/lib/email";
import { logAdminAction } from "@/lib/adminLog";

// Owners manage team members (#115-#118):
//   { action: "role", adminRole: "OWNER" | "ADMIN" }
//   { action: "disable" }       can't log in; logged out right away
//   { action: "enable" }
//   { action: "remove" }        leaves the team for good; logged out right away
//   { action: "reset-2fa" }     sets up 2-step verification again at next login
//   { action: "end-sessions" }  logs them out everywhere
// There must always be at least one active Owner. Every change is logged.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (admin.adminRole !== "OWNER") return NextResponse.json({ error: "Only Owners can manage the team" }, { status: 403 });

  const member = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, role: true, adminRole: true, adminDisabledAt: true, removedByAdmin: true },
  });
  if (!member || member.role !== "ADMIN" || member.removedByAdmin) return NextResponse.json({ error: "Team member not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const self = member.id === admin.id;
  const isOwner = normalizeAdminRole(member.adminRole) === "OWNER";
  const lastOwner = isOwner && !member.adminDisabledAt && (await activeOwnerCount(member.id)) === 0;
  const log = (a: string, summary: string, details?: Record<string, unknown>) =>
    logAdminAction({ adminId: admin.id, action: a, summary, targetType: "USER", targetId: member.id, targetUserId: member.id, details });
  const tell = (text: string) => sendTeamAccessChangedEmail(member.email, member.name, text).catch((err) => console.error("Couldn't send the team email:", err));

  if (action === "role") {
    const next = body.adminRole === "OWNER" ? "OWNER" : body.adminRole === "ADMIN" ? "ADMIN" : null;
    if (!next) return NextResponse.json({ error: "Pick Owner or Admin" }, { status: 400 });
    if (next === normalizeAdminRole(member.adminRole)) return NextResponse.json({ ok: true });
    if (next === "ADMIN" && lastOwner) return NextResponse.json({ error: "There must always be at least one Owner. Make someone else an Owner first." }, { status: 400 });
    await prisma.user.update({ where: { id: member.id }, data: { adminRole: next } });
    await log("TEAM_ROLE_CHANGE", `Changed ${member.name} from ${ADMIN_ROLE_LABEL[normalizeAdminRole(member.adminRole)]} to ${ADMIN_ROLE_LABEL[next]}`, { from: normalizeAdminRole(member.adminRole), to: next });
    await tell(`Your role on the MentorsMD admin team is now ${ADMIN_ROLE_LABEL[next]}.`);
    return NextResponse.json({ ok: true });
  }

  if (action === "disable" || action === "remove") {
    if (self) return NextResponse.json({ error: `You can't ${action} yourself. Ask another Owner.` }, { status: 400 });
    if (lastOwner) return NextResponse.json({ error: "There must always be at least one active Owner." }, { status: 400 });
    if (action === "disable") {
      await prisma.user.update({ where: { id: member.id }, data: { adminDisabledAt: new Date() } });
      await revokeSessions(member.id);
      await log("TEAM_DISABLE", `Disabled ${member.name}'s admin access (logged out everywhere)`);
      await tell("Your MentorsMD admin access has been turned off, and you've been logged out.");
    } else {
      await prisma.user.update({
        where: { id: member.id },
        data: { adminDisabledAt: new Date(), removedByAdmin: true, profileStatus: "REMOVED", removedAt: new Date(), removedReason: "Removed from the admin team", twoFactorMethod: null, totpSecret: null },
      });
      await revokeSessions(member.id);
      await log("TEAM_REMOVE", `Removed ${member.name} (${member.email}) from the team (logged out everywhere)`);
      await tell("You've been removed from the MentorsMD admin team, and you've been logged out.");
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "enable") {
    if (!member.adminDisabledAt) return NextResponse.json({ ok: true });
    await prisma.user.update({ where: { id: member.id }, data: { adminDisabledAt: null } });
    await log("TEAM_ENABLE", `Turned ${member.name}'s admin access back on`);
    await tell("Your MentorsMD admin access has been turned back on. You can log in again.");
    return NextResponse.json({ ok: true });
  }

  if (action === "reset-2fa") {
    await prisma.user.update({ where: { id: member.id }, data: { twoFactorMethod: null, totpSecret: null, totpLastStep: null, twoFactorEnabledAt: null } });
    await revokeSessions(member.id);
    await log("TEAM_2FA_RESET", `Reset ${member.name}'s 2-step verification (they set it up again at next login)`);
    if (!self) await tell("Your 2-step verification was reset. You'll set it up again the next time you log in.");
    return NextResponse.json({ ok: true, loggedOut: self });
  }

  if (action === "end-sessions") {
    await revokeSessions(member.id);
    await log("TEAM_END_SESSIONS", `Logged ${member.name} out everywhere`);
    return NextResponse.json({ ok: true, loggedOut: self });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
