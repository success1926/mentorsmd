import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMentorListed } from "@/lib/mentor";
import { toDate } from "@/lib/publicCache";
import { cachedPublicProfile, mentorProfileView } from "@/lib/mentorProfile";
import { ProfileClient } from "./ProfileClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// The data is put together in lib/mentorProfile.ts (shared with the phone
// app's /api/mentors/[id]).

// Each listed mentor's own title and description for search results and
// link previews ("Varun Challa, BS/MD Student | MentorsMD"). Hidden or
// removed profiles get a plain title so nothing about them leaks.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const data = await cachedPublicProfile(params.id).catch(() => null);
  const s = data?.seller;
  if (!s || s.role !== "SELLER") return { title: "Mentor Profile" };
  const listed = isMentorListed({
    profileStatus: s.profileStatus,
    pausedUntil: s.pausedUntil && toDate(s.pausedUntil),
    safetyHoldAt: s.safetyHoldAt && toDate(s.safetyHoldAt),
    profileCompleteAt: s.profileCompleteAt && toDate(s.profileCompleteAt),
  });
  if (!listed) return { title: "Mentor Profile", robots: { index: false } };
  const title = s.credential ? `${s.name}, ${s.credential}` : s.name;
  const bio = (s.bio || "").replace(/\s+/g, " ").trim();
  const description = bio
    ? bio.length > 155 ? `${bio.slice(0, 152).trimEnd()}…` : bio
    : `${s.name} is a MentorsMD mentor, vetted by our senior team. Message them for free or book a free 15-minute intro call.`;
  return {
    title,
    description,
    openGraph: { title: `${title} | MentorsMD`, description, ...(s.photoUrl?.startsWith("http") ? { images: [s.photoUrl] } : {}) },
  };
}

export default async function MentorProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const view = await mentorProfileView(params.id, { id: (session?.user as any)?.id, role: (session?.user as any)?.role });
  if (!view) notFound();
  return <ProfileClient seller={view.seller} previewState={view.previewState} offers={view.offers} reviews={view.reviews} />;
}
