import Link from "next/link";
import { Vetted } from "@/components/ui";
import { MentorApplicationForm } from "@/components/MentorApplicationForm";

export const metadata = { title: "Apply to mentor · MentorsMD" };

export default function ApplyPage() {
  return (
    <div className="page-narrow stack-lg">
      <div className="stack" style={{ gap: 14 }}>
        <Vetted />
        <h1 className="page-title">Apply to mentor</h1>
        <p className="lede">
          Tell us a little about yourself. Our senior team reviews every application and usually replies within a few days. If you&apos;re a fit, we&apos;ll email you a one-time invite to set up your profile.
        </p>
        <span className="text-secondary small">
          Already have an invite? Open the link in your invite email. <Link href="/become-a-mentor" className="link">How mentoring works</Link>
        </span>
      </div>
      <MentorApplicationForm />
    </div>
  );
}
