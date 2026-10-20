"use client";

import Link from "next/link";
import { useNavStatus } from "@/components/NavStatus";

// A gentle one-line reminder for students who haven't filled in "About
// you" (lib/studentProfile.ts), where they message a mentor or book an
// intro call. Shows nothing for anyone else.
export function AboutYouNudge({ style }: { style?: React.CSSProperties }) {
  const student = useNavStatus()?.student;
  if (!student || student.profileFilled) return null;
  return (
    <span className="text-muted small" style={style}>
      Mentors can help faster when they know your stage. <Link href="/about-you" className="link">Add it in About you</Link> (1 minute).
    </span>
  );
}
