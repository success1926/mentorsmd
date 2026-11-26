import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStudentProfileEmpty, profileFromRow, studentProfileSelect } from "@/lib/studentProfile";
import { canSeeStudentProfile } from "@/lib/studentProfileAccess";
import { requireUser } from "@/lib/session";

// A student's profile, for a mentor who works with them (or an admin):
// Messages, the package page and the call page (components/StudentCard.tsx).
// Never public; students under 18 never show a photo.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const viewer = await requireUser();
  if (viewer instanceof NextResponse) return viewer;
  const student = await prisma.user.findUnique({ where: { id: params.id }, select: { ...studentProfileSelect, id: true, name: true, photoUrl: true, minorStatus: true, role: true } });
  if (!student || student.role !== "BUYER" || !(await canSeeStudentProfile({ id: viewer.id, role: viewer.role }, student.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const profile = profileFromRow(student);
  return NextResponse.json({
    id: student.id,
    name: student.name,
    photoUrl: student.minorStatus ? null : student.photoUrl,
    minor: !!student.minorStatus,
    profile,
    empty: isStudentProfileEmpty(profile),
  });
}
