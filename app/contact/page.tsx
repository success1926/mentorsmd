import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";
import { getSiteContent } from "@/lib/siteContentStore";
import { ContactForm } from "@/components/ContactForm";
import { PageSections } from "@/components/website/PageSections";

export const metadata = { title: "Contact Us", description: "Questions about MentorsMD, an order or becoming a mentor? Send us a message and we usually reply within one business day." };

// The email, phone and text are edited in Admin -> Website. Their defaults
// come from NEXT_PUBLIC_CONTACT_EMAIL / NEXT_PUBLIC_CONTACT_PHONE in Vercel
// (lib/siteContent.ts). The phone card only shows when a number is set.
// The message form saves a lead (Admin -> Leads) and emails the team.
export default async function ContactPage({ searchParams }: { searchParams: { topic?: string } }) {
  const c = await getSiteContent("contact");
  const EMAIL = c.email;
  const PHONE = c.phone;
  const mentor = searchParams?.topic === "mentor";
  const subject = mentor ? "Mentor application" : "Question for MentorsMD";
  // Sections by id (lib/pageLayout.ts), in the order set in Admin -> Website -> Layout.
  const sections: Record<string, React.ReactNode> = {
    intro: (
      <>
        <div className="stack-sm">
          {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
          <h1 className="page-title">{mentor ? c.mentorTitle : c.title}</h1>
          {(mentor ? c.mentorIntro : c.intro) && <p className="lede">{mentor ? c.mentorIntro : c.intro}</p>}
        </div>
        {mentor && (
          <Link href="/become-a-mentor#apply" className="card card-tint row" style={{ gap: 16 }}>
            <span className="icon-dot" style={{ background: "#fff" }}><Icon d={ICONS.doc} /></span>
            <span className="stack-sm grow" style={{ gap: 2 }}>
              <b>Apply to mentor</b>
              <span className="text-secondary">Fill in the application form (takes about 5 minutes)</span>
            </span>
            <Icon d={ICONS.arrow} />
          </Link>
        )}
        {mentor && <p className="text-secondary">Questions before you apply? Get in touch:</p>}
      </>
    ),
    details: (
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
    ),
    form: <ContactForm title={c.formTitle} intro={c.formIntro} success={c.formSuccess} defaultTopic={mentor ? "MENTOR" : "STUDENT"} />,
    orderBox: !mentor && (
      <div className="card card-tint stack-sm">
        <b>{c.orderTitle}</b>
        {c.orderText && <span className="text-secondary">{c.orderText}</span>}
      </div>
    ),
    mentorBox: !mentor && (
      <div className="card card-tint stack-sm">
        <b>{c.mentorBoxTitle}</b>
        <span className="text-secondary">
          {c.mentorBoxBefore} <Link href="/become-a-mentor#apply" className="link">{c.mentorBoxLink}</Link> {c.mentorBoxAfter}
        </span>
      </div>
    ),
  };
  return (
    <div className="page-narrow stack-lg">
      <PageSections page="contact" layout={c.layout} sections={sections} contained unit={20} />
    </div>
  );
}
