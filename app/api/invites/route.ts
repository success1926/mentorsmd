import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { createAndSendInvite } from "@/lib/invites";
import { normalizeEmail } from "@/lib/validate";

// This is the whole access-control mechanism for who can become a seller:
// only an authenticated ADMIN can call this route to mint a code. There is
// no other path in the codebase that creates a SELLER-role user without
// one of these codes being redeemed first (see /api/signup/seller).
//
// The admin never has to copy/paste anything: this route emails the
// seller a one-click link with the code already embedded in the URL, so
// they just click through and land on a pre-filled signup form.

// Admins whose role includes Mentors (lib/adminPermissions.ts).
const requireAdmin = () => currentAdmin("mentors");

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email: rawEmail } = await req.json().catch(() => ({}));
  const email = normalizeEmail(rawEmail);
  if (!email) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const result = await createAndSendInvite(email, admin.id);
  return NextResponse.json(result);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const invites = await prisma.invite.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  // For "Joined" invites, show who joined (their name and profile).
  const ids = invites.map((i) => i.redeemedByUserId).filter((id): id is string => !!id);
  const joined = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, createdAt: true } })
    : [];
  const byId = new Map(joined.map((u) => [u.id, u]));

  return NextResponse.json({
    invites: invites.map((i) => ({ ...i, joinedUser: i.redeemedByUserId ? byId.get(i.redeemedByUserId) ?? null : null })),
  });
}
