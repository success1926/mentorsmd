import { NextResponse } from "next/server";
import { FinishError, markWorkComplete, studentResponds } from "@/lib/orderFinish";
import { getSession } from "@/lib/session";

// Finishing an hours package (docs/redesign-2026-10.md section 5):
//   { action: "MARK_COMPLETE" }                    mentor
//   { action: "APPROVE" }                          student, within the 48 hours
//   { action: "LAST_CALL" | "LAST_REVISION", note } student, once per package
// Opening a dispute uses /api/orders/[id]/dispute, as before.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note : "";
  try {
    if (body.action === "MARK_COMPLETE") await markWorkComplete(params.id, userId);
    else if (["APPROVE", "LAST_CALL", "LAST_REVISION"].includes(body.action)) await studentResponds(params.id, userId, body.action, note);
    else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof FinishError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Finishing a package failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
