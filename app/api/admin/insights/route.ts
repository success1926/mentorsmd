import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { TABS, runInsights, toCsv, type Tab } from "@/lib/insights";
import { csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin -> Insights (#77-#86). Admins only.
//   ?tab=overview|mentors|breakdowns|activity|funnel|demand|students|log
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=America/New_York  (default: last 30 days)
//   Leaderboard filters: ?school= &type= &stage= &service=
//   Funnel: ?mentor=<id>   Activity log: ?kind= &who=
//   CSV (#84): add ?format=csv&table=<table, chart or "summary" key>
export async function GET(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const tab = (TABS as readonly string[]).includes(sp.get("tab") || "") ? (sp.get("tab") as Tab) : "overview";
  const csv = sp.get("format") === "csv";
  const { range, result } = await runInsights(tab, sp, csv);

  if (!csv) {
    return NextResponse.json({ range: { from: range.from, to: range.to, tz: range.tz, bucket: range.bucket }, ...result }, { headers: { "Cache-Control": "no-store" } });
  }
  const key = (sp.get("table") || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
  const body = toCsv(result, key);
  if (body === null) return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  return csvResponse(`mentorsmd-${tab}-${key}-${range.from}-to-${range.to}.csv`, body);
}
