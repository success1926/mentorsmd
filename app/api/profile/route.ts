import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS, isNonEmptyString } from "@/lib/validate";
import { BACKGROUNDS, SCHOOL_TYPES, STAGES, isValue } from "@/lib/options";
import { hasAvailability } from "@/lib/schedule";
import { isValidTimeZone } from "@/lib/tz";
import { RESERVED_NAME_ERROR, isReservedName } from "@/lib/reservedNames";

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "your calendar";
  }
}

// The logged-in user's own profile. Anyone can edit their name; coaches
// can also edit the credential and bio shown on their public profile.
// The photo is set separately by /api/profile/photo (it's a file upload).

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: {
      id: true, name: true, email: true, role: true, credential: true, bio: true, photoUrl: true, passwordHash: true,
      mentorStage: true, schoolType: true, backgrounds: true,
      profileStatus: true, pausedUntil: true, awayNote: true, removedAt: true, removedByAdmin: true,
      timeZone: true, weeklyHours: true, bufferMinutes: true, minNoticeHours: true, daysOff: true,
      externalCalUrl: true, externalCalError: true, externalBusyFetchedAt: true,
      acceptsMinors: true, dateOfBirth: true, minorStatus: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { passwordHash, externalCalUrl, ...profile } = user;
  // Never send the hash itself - just whether one exists (Google-only
  // accounts have none, so they can't "change" a password). The secret
  // calendar address is only shown shortened.
  return NextResponse.json({
    profile: {
      ...profile,
      hasPassword: !!passwordHash,
      hasAvailability: hasAvailability(user.weeklyHours),
      externalCal: externalCalUrl ? { host: safeHost(externalCalUrl) } : null,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = (session.user as any).id;
  const isSeller = (session.user as any).role === "SELLER";
  const body = await req.json().catch(() => ({}));
  const data: {
    name?: string;
    credential?: string | null;
    bio?: string | null;
    mentorStage?: string;
    schoolType?: string;
    backgrounds?: string[];
    timeZone?: string;
    acceptsMinors?: boolean;
  } = {};

  // Time zone: anyone. `onlyIfEmpty` is the automatic browser detection,
  // which never overwrites a zone the person picked themselves.
  if (body.timeZone !== undefined) {
    if (!isValidTimeZone(body.timeZone)) return NextResponse.json({ error: "Pick a valid time zone" }, { status: 400 });
    if (body.onlyIfEmpty) {
      await prisma.user.updateMany({ where: { id: userId, timeZone: null }, data: { timeZone: body.timeZone } });
      if (Object.keys(body).every((k) => k === "timeZone" || k === "onlyIfEmpty")) return NextResponse.json({ ok: true });
    } else {
      data.timeZone = body.timeZone;
    }
  }

  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name, LIMITS.name)) {
      return NextResponse.json({ error: `Name is required (max ${LIMITS.name} characters)` }, { status: 400 });
    }
    // Admins may use any name; nobody else can pose as staff.
    if ((session.user as any).role !== "ADMIN" && isReservedName(body.name)) {
      return NextResponse.json({ error: RESERVED_NAME_ERROR }, { status: 400 });
    }
    data.name = body.name.trim();
  }

  if (isSeller) {
    if (body.credential !== undefined) {
      if (!isNonEmptyString(body.credential, LIMITS.credential)) {
        return NextResponse.json({ error: `Credential is required (max ${LIMITS.credential} characters)` }, { status: 400 });
      }
      data.credential = body.credential.trim();
    }
    if (body.bio !== undefined) {
      if (typeof body.bio !== "string" || body.bio.length > LIMITS.bio) {
        return NextResponse.json({ error: `Bio must be under ${LIMITS.bio} characters` }, { status: 400 });
      }
      data.bio = body.bio.trim() || null;
    }
    // Mentor-level search answers (asked once, used for every package).
    if (body.mentorStage !== undefined) {
      if (!isValue(STAGES, body.mentorStage)) return NextResponse.json({ error: "Pick your stage" }, { status: 400 });
      data.mentorStage = body.mentorStage;
    }
    if (body.schoolType !== undefined) {
      if (!isValue(SCHOOL_TYPES, body.schoolType)) return NextResponse.json({ error: "Pick your school type" }, { status: 400 });
      data.schoolType = body.schoolType;
    }
    // "Work with students under 18" (#110).
    if (body.acceptsMinors !== undefined) {
      if (typeof body.acceptsMinors !== "boolean") return NextResponse.json({ error: "Invalid setting" }, { status: 400 });
      data.acceptsMinors = body.acceptsMinors;
    }
    if (body.backgrounds !== undefined) {
      if (!Array.isArray(body.backgrounds) || !body.backgrounds.every((b: unknown) => isValue(BACKGROUNDS, b))) {
        return NextResponse.json({ error: "Unknown background option" }, { status: 400 });
      }
      data.backgrounds = Array.from(new Set(body.backgrounds as string[]));
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, credential: true, bio: true, photoUrl: true, mentorStage: true, schoolType: true, backgrounds: true, timeZone: true, acceptsMinors: true },
  });
  return NextResponse.json({ profile: updated });
}
