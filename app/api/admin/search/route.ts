import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { can, ORDER_VIEW_PERMISSIONS } from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";

// The search box at the top of the admin sidebar
// (components/admin/AdminSearch.tsx). One box finds people (name or
// email), orders (by id), leads, mentor applications and calls, and only
// searches what the admin's role allows. Each result links to the admin
// page that already shows it.
//   GET ?q=text   (at least 2 characters)

type Hit = { type: string; label: string; sub: string; href: string };

const PER_TYPE = 5;
// The same window Admin -> Calls & recordings lists.
const CALLS_PAST_DAYS = 60;
const CALLS_AHEAD_DAYS = 14;

const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

export async function GET(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ hits: [] });
  // Ids are one word; only look things up by id when the search could be one.
  const idLike = /^[a-z0-9]{6,40}$/i.test(q);

  const searches: Promise<Hit[]>[] = [];

  if (can(admin, "people")) {
    searches.push(
      prisma.user
        .findMany({
          where: { role: { in: ["SELLER", "BUYER"] }, OR: [{ name: contains(q) }, { email: contains(q) }, ...(idLike ? [{ id: q }] : [])] },
          select: { id: true, name: true, email: true, role: true, profileStatus: true },
          orderBy: { createdAt: "desc" },
          take: PER_TYPE,
        })
        .then((rows) =>
          rows.map((u) => ({
            type: "Person",
            label: u.name,
            sub: `${u.role === "SELLER" ? "Mentor" : "Student"} · ${u.email}${u.profileStatus === "REMOVED" ? " · removed" : ""}`,
            href: `/admin/people?${new URLSearchParams({ role: u.role, q: u.email, view: u.id })}`,
          }))
        )
    );
  }

  if (can(admin, "team")) {
    searches.push(
      prisma.user
        .findMany({
          where: { role: "ADMIN", OR: [{ name: contains(q) }, { email: contains(q) }] },
          select: { id: true, name: true, email: true },
          take: PER_TYPE,
        })
        .then((rows) => rows.map((u) => ({ type: "Team", label: u.name, sub: `Admin team · ${u.email}`, href: "/admin/team" })))
    );
  }

  if (can(admin, ORDER_VIEW_PERMISSIONS) && idLike) {
    searches.push(
      prisma.order
        .findMany({
          where: { OR: [{ id: q }, { id: { startsWith: q } }] },
          select: { id: true, createdAt: true, packageTitle: true, gig: { select: { title: true } }, buyer: { select: { name: true } }, seller: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: PER_TYPE,
        })
        .then((rows) =>
          rows.map((o) => ({
            type: "Order",
            label: o.packageTitle || o.gig.title,
            sub: `Order ${o.id} · ${o.buyer.name} with ${o.seller.name} · ${fmtDay(o.createdAt)}`,
            href: `/orders/${o.id}`,
          }))
        )
    );
  }

  if (can(admin, "leads")) {
    searches.push(
      prisma.lead
        .findMany({
          where: { OR: [{ name: contains(q) }, { email: contains(q) }, ...(idLike ? [{ id: q }] : [])] },
          select: { id: true, kind: true, name: true, email: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: PER_TYPE,
        })
        .then((rows) =>
          rows.map((l) => ({
            type: l.kind === "WAITLIST" ? "Waitlist" : "Contact message",
            label: l.name || l.email,
            sub: `${l.kind === "WAITLIST" ? "Waitlist signup" : "Contact message"} · ${l.email} · ${fmtDay(l.createdAt)}`,
            href: `/admin/leads?tab=${l.kind}&open=${l.id}`,
          }))
        )
    );
  }

  if (can(admin, "applications")) {
    const inLeads = can(admin, "leads");
    searches.push(
      prisma.mentorApplication
        .findMany({
          where: { OR: [{ name: contains(q) }, { email: contains(q) }, { medicalSchool: contains(q) }, ...(idLike ? [{ id: q }] : [])] },
          select: { id: true, name: true, email: true, medicalSchool: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: PER_TYPE,
        })
        .then((rows) =>
          rows.map((a) => ({
            type: "Mentor application",
            label: a.name,
            sub: `Mentor application · ${a.medicalSchool} · ${a.email} · ${fmtDay(a.createdAt)}`,
            href: inLeads ? `/admin/leads?tab=APPLICATION&open=${a.id}` : "/admin/applications",
          }))
        )
    );
  }

  if (can(admin, "calls")) {
    const person = { OR: [{ name: contains(q) }, { email: contains(q) }] };
    const from = new Date(Date.now() - CALLS_PAST_DAYS * 86400_000);
    const to = new Date(Date.now() + CALLS_AHEAD_DAYS * 86400_000);
    searches.push(
      prisma.callBooking
        .findMany({
          where: {
            OR: [
              ...(idLike ? [{ id: q }] : []),
              { student: person },
              { mentor: person },
              { order: { buyer: person } },
              { order: { seller: person } },
            ],
          },
          select: {
            id: true, startTime: true, kind: true, orderId: true,
            student: { select: { name: true } },
            mentor: { select: { name: true } },
            order: { select: { buyer: { select: { name: true } }, seller: { select: { name: true } } } },
          },
          orderBy: { startTime: "desc" },
          take: PER_TYPE,
        })
        .then((rows) =>
          rows.map((c) => {
            const listed = c.startTime >= from && c.startTime <= to;
            const student = c.order?.buyer.name ?? c.student?.name ?? "Student";
            const mentor = c.order?.seller.name ?? c.mentor?.name ?? "Mentor";
            return {
              type: "Call",
              label: `${student} with ${mentor}`,
              sub: `${c.kind === "INTRO" || !c.orderId ? "Free intro call" : "Call"} · ${fmtDay(c.startTime)}`,
              // Calls outside the Calls page's window are shown on their package's page.
              href: listed || !c.orderId ? `/admin/calls?open=${c.id}` : `/orders/${c.orderId}`,
            };
          })
        )
    );
  }

  const results = await Promise.allSettled(searches);
  const hits = results.flatMap((r) => {
    if (r.status === "fulfilled") return r.value;
    console.error("Admin search part failed:", r.reason);
    return [];
  });
  return NextResponse.json({ hits: hits.slice(0, 30) }, { headers: { "Cache-Control": "private, no-store" } });
}
