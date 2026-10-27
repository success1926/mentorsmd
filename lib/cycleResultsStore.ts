// Cycle results, database side (lib/cycleResults.ts has the rules).
// Server only.
import { prisma } from "@/lib/prisma";
import { RESULTS_PER_STUDENT_MAX, cleanResult } from "@/lib/cycleResults";

export class ResultError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// The mentors a student can say helped: anyone they've messaged or
// bought from on MentorsMD.
export async function mentorsForStudent(studentId: string) {
  const [convos, orders] = await Promise.all([
    prisma.conversation.findMany({ where: { buyerId: studentId }, select: { sellerId: true } }),
    prisma.order.findMany({ where: { buyerId: studentId, status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED", "REFUNDED"] } }, select: { sellerId: true } }),
  ]);
  const ids = Array.from(new Set([...convos, ...orders].map((r) => r.sellerId)));
  if (!ids.length) return [];
  return prisma.user.findMany({ where: { id: { in: ids }, role: "SELLER" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function resultsForStudent(studentId: string) {
  return prisma.cycleResult.findMany({ where: { userId: studentId }, orderBy: [{ cycle: "desc" }, { school: "asc" }] });
}

// Adds a school, or changes one (id given). One row per school per cycle.
export async function saveResult(studentId: string, body: any) {
  const clean = cleanResult(body);
  if ("error" in clean) throw new ResultError(clean.error);
  const allowed = new Set((await mentorsForStudent(studentId)).map((m) => m.id));
  const data = { ...clean, mentorIds: clean.mentorIds.filter((id) => allowed.has(id)) };
  const id = typeof body?.id === "string" ? body.id : null;
  const clash = await prisma.cycleResult.findUnique({ where: { userId_cycle_school: { userId: studentId, cycle: data.cycle, school: data.school } }, select: { id: true } });
  if (clash && clash.id !== id) throw new ResultError("That school is already on your list for this cycle.", 409);
  if (id) {
    const res = await prisma.cycleResult.updateMany({ where: { id, userId: studentId }, data });
    if (!res.count) throw new ResultError("Not found", 404);
    return prisma.cycleResult.findUniqueOrThrow({ where: { id } });
  }
  if ((await prisma.cycleResult.count({ where: { userId: studentId } })) >= RESULTS_PER_STUDENT_MAX) throw new ResultError(`At most ${RESULTS_PER_STUDENT_MAX} schools.`);
  return prisma.cycleResult.create({ data: { ...data, userId: studentId } });
}

export async function deleteResult(studentId: string, id: string) {
  const res = await prisma.cycleResult.deleteMany({ where: { id, userId: studentId } });
  if (!res.count) throw new ResultError("Not found", 404);
}
