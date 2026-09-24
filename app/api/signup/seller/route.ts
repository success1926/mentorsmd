import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { LIMITS, isNonEmptyString, normalizeEmail } from "@/lib/validate";

// THIS is the route that enforces "sellers can't sign up on their own."
// It is the only place a SELLER-role user is ever created, and it refuses
// to run unless a matching, unexpired, unredeemed Invite row exists.
// Never trust a client-side check for this - always verify the code here,
// server-side, against the database.
export async function POST(req: Request) {
  const { code, email: rawEmail, password, name, credential, bio } = await req.json();

  const email = normalizeEmail(rawEmail);
  if (typeof code !== "string" || !email || !isNonEmptyString(name, LIMITS.name)) {
    return NextResponse.json({ error: "Invite code, name, email, and password are required" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if ((credential && (typeof credential !== "string" || credential.length > LIMITS.credential)) ||
      (bio && (typeof bio !== "string" || bio.length > LIMITS.bio))) {
    return NextResponse.json({ error: "Credential or bio is too long" }, { status: 400 });
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
  if (invite.email.toLowerCase() !== email) {
    return NextResponse.json({ error: "This code was issued to a different email address" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Transaction: burn the invite code and create the seller together. The
  // invite update is conditional on it still being PENDING, so a code can
  // never be redeemed twice even under concurrent requests.
  try {
    const user = await prisma.$transaction(async (tx) => {
      const burned = await tx.invite.updateMany({
        where: { id: invite.id, status: "PENDING" },
        data: { status: "REDEEMED" },
      });
      if (burned.count === 0) throw new Error("INVITE_ALREADY_USED");
      const created = await tx.user.create({
        data: { email, name: name.trim(), passwordHash, role: "SELLER", credential: credential || null, bio: bio || null },
      });
      await tx.invite.update({ where: { id: invite.id }, data: { redeemedByUserId: created.id } });
      return created;
    });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (err: any) {
    if (err?.message === "INVITE_ALREADY_USED" || err?.code === "P2002") {
      return NextResponse.json({ error: "That invite has already been used, or this email already has an account" }, { status: 409 });
    }
    throw err;
  }
}
