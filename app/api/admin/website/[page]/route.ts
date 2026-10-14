import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { SITE_PAGES, checkValues, defaultValues, diffFromDefaults, isSitePageKey, resolveValues } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

// One page in Admin -> Website: its fields, defaults, live and draft values.
export async function GET(_req: Request, { params }: { params: { page: string } }) {
  const admin = await currentAdmin("website");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const key = params.page;
  if (!isSitePageKey(key)) return NextResponse.json({ error: "Unknown page" }, { status: 404 });
  const row = await prisma.siteContent.findUnique({ where: { key } }).catch(() => null);
  const live = resolveValues(key, row?.live ?? null);
  return NextResponse.json({
    key,
    page: SITE_PAGES[key],
    defaults: defaultValues(key),
    live,
    values: row?.draft != null ? resolveValues(key, row.draft) : live,
    hasDraft: row?.draft != null,
    updatedAt: row?.updatedAt ?? null,
    publishedAt: row?.publishedAt ?? null,
  });
}

// Save draft. Only fields that differ from the built-in defaults are stored.
export async function PUT(req: Request, { params }: { params: { page: string } }) {
  const admin = await currentAdmin("website");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const key = params.page;
  if (!isSitePageKey(key)) return NextResponse.json({ error: "Unknown page" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.values !== "object") return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  if (JSON.stringify(body.values).length > 200_000) return NextResponse.json({ error: "That's too much text for one page." }, { status: 400 });

  const { values, errors } = checkValues(key, body.values);
  if (errors.length) return NextResponse.json({ error: "Please fix these first:", errors }, { status: 400 });
  const diff = diffFromDefaults(key, values as Record<string, unknown>);

  const row = await prisma.siteContent.findUnique({ where: { key } });
  const liveDiff = row?.live ? diffFromDefaults(key, resolveValues(key, row.live) as Record<string, unknown>) : {};
  // Same as what's live: no unpublished changes.
  const draft = JSON.stringify(diff) === JSON.stringify(liveDiff) ? Prisma.DbNull : (diff as Prisma.InputJsonValue);
  const saved = await prisma.siteContent.upsert({
    where: { key },
    create: { key, draft, updatedById: admin.id },
    update: { draft, updatedById: admin.id },
  });
  return NextResponse.json({ ok: true, hasDraft: saved.draft !== null, updatedAt: saved.updatedAt });
}
