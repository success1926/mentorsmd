import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStudentProfile, profileFromRow, studentProfileSelect } from "@/lib/studentProfile";
import { getSession } from "@/lib/session";

// The student's own profile for mentors (lib/studentProfile.ts).
//   GET                 -> { profile, photoUrl, name, minor, savedAt }
//   PATCH { ...fields } -> saves it (every field optional)
//   PATCH { skip: true } -> "Skip for now" after signup (nothing saved)
async function student() {
  const session = await getSession();
  const user = session?.user as any;
  return user && user.role === "BUYER" ? (user.id as string) : null;
}

export async function GET() {
  const id = await student();
  if (!id) return NextResponse.json({ error: "Only student accounts have a student profile" }, { status: 403 });
  const u = await prisma.user.findUnique({ where: { id }, select: { ...studentProfileSelect, name: true, photoUrl: true, minorStatus: true } });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ profile: profileFromRow(u), name: u.name, photoUrl: u.photoUrl, minor: !!u.minorStatus, savedAt: u.studentProfileAt });
}

export async function PATCH(req: Request) {
  const id = await student();
  if (!id) return NextResponse.json({ error: "Only student accounts have a student profile" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.skip === true) {
    await prisma.user.updateMany({ where: { id, studentProfileAt: null }, data: { studentProfileAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  const parsed = parseStudentProfile(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const u = await prisma.user.update({ where: { id }, data: { ...parsed.data, studentProfileAt: new Date() }, select: studentProfileSelect });
  return NextResponse.json({ profile: profileFromRow(u) });
}
