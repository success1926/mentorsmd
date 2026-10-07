import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";

export const metadata = { title: "Contact us · MentorsMD" };

// Set NEXT_PUBLIC_CONTACT_EMAIL (and optionally NEXT_PUBLIC_CONTACT_PHONE)
// in Vercel. The phone card only shows when a number is set.
const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@mentorsmd.com";
const PHONE = process.env.NEXT_PUBLIC_CONTACT_PHONE || "";

export default function ContactPage({ searchParams }: { searchParams: { topic?: string } }) {
  const mentor = searchParams?.topic === "mentor";
  const subject = mentor ? "Mentor application" : "Question for MentorsMD";
  return (
    <div className="page-narrow stack-lg">
      <div className="stack-sm">
        <h1 className="page-title">{mentor ? "Apply to mentor" : "Contact us"}</h1>
        <p className="lede">
          {mentor
            ? "Mentor applications go through our short application form: your medical school, resume and a few lines about yourself. Our senior team reviews every one and replies within a few days."
            : "Have a question, ran into an issue, or want to talk to a real person? We usually reply within one business day."}
        </p>
      </div>
      {mentor && (
        <Link href="/become-a-mentor/apply" className="card card-tint row" style={{ gap: 16 }}>
          <span className="icon-dot" style={{ background: "#fff" }}><Icon d={ICONS.doc} /></span>
          <span className="stack-sm grow" style={{ gap: 2 }}>
            <b>Apply to mentor</b>
            <span className="text-secondary">Fill in the application form (takes about 5 minutes)</span>
          </span>
          <Icon d={ICONS.arrow} />
        </Link>
      )}
      {mentor && <p className="text-secondary">Questions before you apply? Get in touch:</p>}
      <div className="stack">
        <a href={`mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`} className="card row" style={{ gap: 16 }}>
          <span className="icon-dot"><Icon d={ICONS.chat} /></span>
          <span className="stack-sm" style={{ gap: 2 }}>
            <span className="text-secondary">Email us</span>
            <b>{EMAIL}</b>
          </span>
        </a>
        {PHONE && (
          <a href={`tel:${PHONE.replace(/[^\d+]/g, "")}`} className="card row" style={{ gap: 16 }}>
            <span className="icon-dot"><Icon d={ICONS.clock} /></span>
            <span className="stack-sm" style={{ gap: 2 }}>
              <span className="text-secondary">Call us</span>
              <b>{PHONE}</b>
            </span>
          </a>
        )}
      </div>
      {!mentor && (
        <div className="card card-tint stack-sm">
          <b>Problem with an order?</b>
          <span className="text-secondary">Open the order and use &ldquo;Report a problem&rdquo; (or &ldquo;Open a dispute&rdquo; under a delivery). Payment stays on hold while our team looks into it.</span>
        </div>
      )}
      {!mentor && (
        <div className="card card-tint stack-sm">
          <b>Want to become a mentor?</b>
          <span className="text-secondary">
            Please don&apos;t email your resume. <Link href="/become-a-mentor/apply" className="link">Apply with the mentor application form</Link> so our senior team can review it.
          </span>
        </div>
      )}
    </div>
  );
}
