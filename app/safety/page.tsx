import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";

export const metadata = { title: "Safety tips · MentorsMD" };

const TIPS: { icon: string; title: string; body: string }[] = [
  { icon: ICONS.lock, title: "Pay only on MentorsMD", body: "Your payment is held until you approve the work. If someone asks you to pay with Venmo, Zelle, PayPal, Cash App or cash, it's a red flag. Say no and report it." },
  { icon: ICONS.chat, title: "Keep the conversation here", body: "Use MentorsMD messages and video calls. If a deal moves off the site, we can't help with refunds or disputes." },
  { icon: ICONS.shield, title: "Never share passwords", body: "No mentor, student or staff member ever needs your AMCAS, AACOMAS, TMDSAS or email login. Anyone who asks is breaking our rules." },
  { icon: ICONS.pen, title: "Your essays are yours", body: "A good mentor helps you write a better essay. Anyone offering to write it for you is putting your application at risk." },
  { icon: ICONS.alert, title: "Be careful with links", body: "Links in messages open a \"You're leaving MentorsMD\" page first. Don't enter passwords or payment details on a site someone sent you." },
  { icon: ICONS.check, title: "Look for the staff badge", body: "Real MentorsMD staff have a \"MentorsMD staff\" badge. Names like Admin or Support are blocked, so anyone claiming to be staff without the badge isn't." },
];

export default function SafetyPage() {
  return (
    <div className="page-narrow stack-lg">
      <div className="stack-sm">
        <h1 className="page-title">Safety tips</h1>
        <p className="lede">A few habits that keep your application, your money and your accounts safe.</p>
      </div>
      <div className="stack">
        {TIPS.map((t) => (
          <div key={t.title} className="card row" style={{ gap: 16, alignItems: "flex-start" }}>
            <span className="icon-dot"><Icon d={t.icon} /></span>
            <span className="stack-sm" style={{ gap: 4 }}>
              <b>{t.title}</b>
              <span className="text-secondary" style={{ lineHeight: 1.6 }}>{t.body}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="card card-tint stack-sm">
        <b>Something feels wrong?</b>
        <span className="text-secondary" style={{ lineHeight: 1.6 }}>
          Use <b>Report</b> in the conversation (the ⋯ menu, or Report under a message) or on the person&apos;s profile. You can also block them, so neither of you can message the other. For a problem with an order, open the order and use &ldquo;Open a dispute&rdquo;: payment stays held while our team looks into it. If you&apos;re in danger, contact local emergency services first.
        </span>
        <span className="text-secondary">
          Read the full <Link href="/community-guidelines" className="link">Community Guidelines</Link> or <Link href="/contact" className="link">contact us</Link>.
        </span>
      </div>
    </div>
  );
}
