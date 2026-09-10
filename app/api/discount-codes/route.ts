import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function requireAdmin(session: any) {
  return session?.user && (session.user as any).role === "ADMIN";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { code, percentOff, amountOffDollars, expiresAt, maxRedemptions } = await req.json();
  if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });
  if (!percentOff && !amountOffDollars) {
    return NextResponse.json({ error: "Set either a percent off or a dollar amount off" }, { status: 400 });
  }

  const discountCode = await prisma.discountCode.create({
    data: {
      code: code.trim().toUpperCase(),
      percentOff: percentOff ? Number(percentOff) : null,
      amountOffCents: amountOffDollars ? Math.round(Number(amountOffDollars) * 100) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
    },
  });

  return NextResponse.json({ discountCode });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const discountCodes = await prisma.discountCode.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ discountCodes });
}
