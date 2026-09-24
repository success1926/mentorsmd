import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LIMITS, isNonEmptyString, normalizeEmail } from "@/lib/validate";

// Buyers can self-register freely - this route has no gate at all.
export async function POST(req: Request) {
  const { email: rawEmail, password, name } = await req.json();

  // Emails are stored lowercase so "Jane@x.com" and "jane@x.com" can't
  // become two separate accounts (and login matches either spelling).
  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if (!isNonEmptyString(name, LIMITS.name)) {
    return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: { email, name: name.trim(), passwordHash, role: "BUYER" },
    });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    // Two signups for the same email at the same instant.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }
    throw err;
  }
}
