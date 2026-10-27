import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CYCLE_RESULTS_ON } from "@/lib/cycleResults";
import { ResultError, deleteResult, mentorsForStudent, resultsForStudent, saveResult } from "@/lib/cycleResultsStore";

export const dynamic = "force-dynamic";

// The student's own cycle results (/dashboard/results, lib/cycleResults.ts).
// Refused while NEXT_PUBLIC_CYCLE_RESULTS isn't 1.
async function student() {
  if (!CYCLE_RESULTS_ON) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (user.role !== "BUYER") return { error: NextResponse.json({ error: "Cycle results are for student accounts" }, { status: 403 }) };
  return { id: user.id as string };
}

function fail(err: unknown) {
  if (err instanceof ResultError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("Cycle results failed", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function GET() {
  const me = await student();
  if ("error" in me) return me.error;
  const [results, mentors] = await Promise.all([resultsForStudent(me.id), mentorsForStudent(me.id)]);
  return NextResponse.json({ results, mentors });
}

// Add a school, or change one ({ id, ... }).
export async function POST(req: Request) {
  const me = await student();
  if ("error" in me) return me.error;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ result: await saveResult(me.id, body) });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request) {
  const me = await student();
  if ("error" in me) return me.error;
  const id = new URL(req.url).searchParams.get("id") || "";
  try {
    await deleteResult(me.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
