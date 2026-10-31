import { NextResponse } from "next/server";
import { confirmOrderFromSession } from "@/lib/hourCheckout";
import { getSession } from "@/lib/session";

// The student is back from Stripe but the webhook hasn't confirmed the
// payment yet: check the Stripe page directly (lib/hourCheckout.ts).
//   { sessionId }   the cs_... id Stripe put on the return link
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;
  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  try {
    const paid = await confirmOrderFromSession(params.id, userId, sessionId);
    return NextResponse.json({ paid });
  } catch (err) {
    console.error("Confirming a payment from the Stripe page failed", params.id, err);
    return NextResponse.json({ paid: false });
  }
}
