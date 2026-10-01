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
            ? "Email us your name, medical school and year, and what you'd like to help students with. Our senior team reviews every application and replies within a few days."
            : "Have a question, ran into an issue, or want to talk to a real person? We usually reply within one business day."}
        </p>
      </div>
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
          <span className="text-secondary">Open the order and use &ldquo;Report a problem&rdquo;. Payment stays on hold while our team looks into it.</span>
        </div>
      )}
    </div>
  );
}
