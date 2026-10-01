import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS, isNonEmptyString } from "@/lib/validate";
import { BACKGROUNDS, SCHOOL_TYPES, STAGES, isValue } from "@/lib/options";

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
      profileStatus: true, pausedUntil: true, awayNote: true, removedAt: true, removedByAdmin: true, calLink: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { passwordHash, ...profile } = user;
  // Never send the hash itself - just whether one exists (Google-only
  // accounts have none, so they can't "change" a password).
  return NextResponse.json({ profile: { ...profile, hasPassword: !!passwordHash } });
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
  } = {};

  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name, LIMITS.name)) {
      return NextResponse.json({ error: `Name is required (max ${LIMITS.name} characters)` }, { status: 400 });
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
    select: { id: true, name: true, credential: true, bio: true, photoUrl: true, mentorStage: true, schoolType: true, backgrounds: true },
  });
  return NextResponse.json({ profile: updated });
}
