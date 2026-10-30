import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";

export const metadata = { title: "Safety Tips", description: "How to stay safe on MentorsMD: pay only on the site, keep messages here and report anything that feels wrong." };

const TIPS: { icon: string; title: string; body: string }[] = [
  { icon: ICONS.lock, title: "Pay Only on MentorsMD", body: "On MentorsMD every hour is logged and our team can help if something goes wrong. If someone asks you to pay with Venmo, Zelle, PayPal, Cash App or cash, it's a red flag. Say no and report it." },
  { icon: ICONS.chat, title: "Keep the Conversation Here", body: "Use MentorsMD messages and video calls. If a deal moves off the site, we can't help with refunds or disputes." },
  { icon: ICONS.shield, title: "Never Share Passwords", body: "No mentor, student or staff member ever needs your AMCAS, AACOMAS, TMDSAS or email login. Anyone who asks is breaking our rules." },
  { icon: ICONS.pen, title: "Your Essays Are Yours", body: "A good mentor helps you write a better essay. Anyone offering to write it for you is putting your application at risk." },
  { icon: ICONS.alert, title: "Be Careful With Links", body: "Links in messages open a \"You're leaving MentorsMD\" page first. Don't enter passwords or payment details on a site someone sent you." },
  { icon: ICONS.check, title: "Look for the Staff Badge", body: "Real MentorsMD staff have a \"MentorsMD staff\" badge. Names like Admin or Support are blocked, so anyone claiming to be staff without the badge isn't." },
];

export default function SafetyPage() {
  return (
    <div className="page-narrow stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">Safety</span>
        <h1 className="page-title">Safety Tips</h1>
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
        <b>Something Feels Wrong?</b>
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
