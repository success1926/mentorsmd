import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_LABEL, activeOwnerCount, currentAdmin, findCustomRole, normalizeAdminRole, revokeSessions, roleLabelFor } from "@/lib/adminTeam";
import { sendTeamAccessChangedEmail } from "@/lib/email";
import { logAdminAction } from "@/lib/adminLog";

// Owners manage team members (#115-#118):
//   { action: "role", adminRole: "OWNER" | "ADMIN", roleId? }  (roleId: a custom
//                               role; not for yourself or an Owner)
//   { action: "disable" }       can't log in; logged out right away
//   { action: "enable" }
//   { action: "remove" }        leaves the team for good; logged out right away
//   { action: "reset-2fa" }     sets up 2-step verification again at next login
//   { action: "end-sessions" }  logs them out everywhere
// There must always be at least one active Owner. Every change is logged.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await currentAdmin("team");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (admin.adminRole !== "OWNER") return NextResponse.json({ error: "Only Owners can manage the team" }, { status: 403 });

  const member = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, role: true, adminRole: true, adminRoleId: true, adminDisabledAt: true, removedByAdmin: true, adminCustomRole: { select: { name: true } } },
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
    // Nobody changes their own role or an Owner's (Owners keep everything).
    if (self) return NextResponse.json({ error: "You can't change your own role." }, { status: 400 });
    if (isOwner) return NextResponse.json({ error: "An Owner's role can't be changed." }, { status: 400 });
    const next = body.adminRole === "OWNER" ? "OWNER" : body.adminRole === "ADMIN" ? "ADMIN" : null;
    if (!next) return NextResponse.json({ error: "Pick a role" }, { status: 400 });
    const customRole = next === "ADMIN" ? await findCustomRole(body.roleId) : null;
    if (next === "ADMIN" && body.roleId && !customRole) return NextResponse.json({ error: "That role no longer exists. Reload the page." }, { status: 400 });
    const nextRoleId = customRole?.id ?? null;
    if (next === normalizeAdminRole(member.adminRole) && nextRoleId === member.adminRoleId) return NextResponse.json({ ok: true });
    const from = roleLabelFor(member);
    const to = customRole?.name ?? ADMIN_ROLE_LABEL[next];
    await prisma.user.update({ where: { id: member.id }, data: { adminRole: next, adminRoleId: nextRoleId } });
    await log("TEAM_ROLE_CHANGE", `Changed ${member.name} from ${from} to ${to}`, { from, to });
    await tell(`Your role on the MentorsMD admin team is now ${to}.`);
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
    await prisma.user.update({ where: { id: member.id }, data: { twoFactorMethod: null, totpSecret: null, totpLastStep: null, twoFactorEnabledAt: null, twoFactorTrustAfter: new Date() } });
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
