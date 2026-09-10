import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

// THIS is the route that enforces "sellers can't sign up on their own."
// It is the only place a SELLER-role user is ever created, and it refuses
// to run unless a matching, unexpired, unredeemed Invite row exists.
// Never trust a client-side check for this - always verify the code here,
// server-side, against the database.
export async function POST(req: Request) {
  const { code, email, password, name, credential, bio } = await req.json();

  if (!code || !email || !password || !name) {
    return NextResponse.json({ error: "Invite code, name, email, and password are required" }, { status: 400 });
  }

  const invite = await prisma.invite.findUnique({ where: { code: code.trim().toUpperCase() } });

  if (!invite) {
    return NextResponse.json({ error: "That invite code doesn't exist" }, { status: 400 });
  }
  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "That invite code has already been used or is no longer valid" }, { status: 400 });
  }
  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ error: "That invite code has expired - ask the admin for a new one" }, { status: 400 });
  }
  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "This code was issued to a different email address" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Transaction: create the seller and burn the invite code together, so a
  // code can never be redeemed twice even under concurrent requests.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, name, passwordHash, role: "SELLER", credential, bio },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { status: "REDEEMED", redeemedByUserId: created.id },
    });
    return created;
  });

  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
