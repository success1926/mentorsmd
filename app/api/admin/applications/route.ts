import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin -> Applications: every mentor application, newest first.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const applications = await prisma.mentorApplication.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      medicalSchool: true,
      residency: true,
      blurb: true,
      resumeUrl: true,
      resumeName: true,
      status: true,
      createdAt: true,
      decidedAt: true,
    },
  });
  return NextResponse.json({ applications });
}
