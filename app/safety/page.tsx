import Link from "next/link";
import { Callout, Icon, ICONS, SectionHead } from "@/components/ui";

export const metadata = { alternates: { canonical: "/safety" }, title: "Safety tips", description: "How to stay safe on MentorsMD: pay only on the site, keep messages here and report anything that feels wrong." };

// A short summary (Nov 2026). The rules themselves live in one place, the
// Community guidelines (/community-guidelines); this page links there
// instead of repeating them.
const SHORT_VERSION: { icon: string; text: string }[] = [
  { icon: ICONS.lock, text: "Pay, message and meet only on MentorsMD. Venmo, Zelle, cash or a move to another app is a red flag." },
  { icon: ICONS.shield, text: "Never share a password or login, and never ask for one. Real staff have the \"MentorsMD staff\" badge." },
  { icon: ICONS.pen, text: "Your essays are yours. Anyone offering to write them is putting your application at risk." },
  { icon: ICONS.alert, text: "Links in messages open a \"You're leaving MentorsMD\" page first. Don't enter passwords or payment details on a site someone sent you." },
];

export default function SafetyPage() {
  return (
    <div className="page-narrow stack-lg">
      <SectionHead as="h1" titleClassName="page-title" eyebrow="Trust & safety" title="Safety tips" lede="A few habits that keep your application, your money and your accounts safe." />
      <ul className="safety-list">
        {SHORT_VERSION.map((t) => (
          <li key={t.text}>
            <span className="icon-dot"><Icon d={t.icon} /></span>
            <span>{t.text}</span>
          </li>
        ))}
      </ul>
      <p className="text-secondary">
        The full rules every student and mentor follows are in our <Link href="/community-guidelines" className="link">community guidelines</Link>.
      </p>
      <Callout title="Something feels wrong?" action={<span className="text-secondary"><Link href="/contact" className="link">Contact us</Link></span>}>
        Use <b>Report</b> in the conversation (the ⋯ menu, or Report under a message) or on the person&apos;s profile. You can also block them, so neither of you can message the other. For a problem with an order, open the order and use &ldquo;Open a dispute&rdquo;: payment stays held while our team looks into it. If you&apos;re in danger, contact local emergency services first.
      </Callout>
    </div>
  );
}
