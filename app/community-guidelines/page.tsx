import Link from "next/link";
import { MENTOR_AGREEMENT_POINTS } from "@/lib/agreement";

export const metadata = { title: "Community Guidelines · MentorsMD" };

const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: "Your work stays your own",
    points: [
      "Mentors give feedback, ideas, edits and coaching. They never write essays, personal statements, secondaries or activity descriptions for a student.",
      "Students never ask a mentor to write their application or take a test (MCAT, CASPer, PREview) for them.",
      "Schools treat ghostwritten applications as dishonest. It can cost a student their seat, and a mentor their own standing.",
    ],
  },
  {
    title: "Keep everything on MentorsMD",
    points: [
      "Pay only through MentorsMD. Payment is held until you approve the work, which is what protects you if something goes wrong.",
      "Don't move to Venmo, Zelle, PayPal, Cash App, cash or any other payment, and don't offer or accept discounts for paying outside.",
      "Use MentorsMD messages and MentorsMD video calls. Don't swap phone numbers, emails, WhatsApp or Zoom links to get around the site.",
      "Share files through MentorsMD so there's a record if there's ever a dispute.",
    ],
  },
  {
    title: "Protect your accounts",
    points: [
      "Never share a password or login, and never ask for one: AMCAS, AACOMAS, TMDSAS, email or anything else. Nobody at MentorsMD will ever ask for it.",
      "MentorsMD staff are marked with a \"MentorsMD staff\" badge. Names like Admin or Support are reserved, so be careful with anyone who claims to be staff without the badge.",
    ],
  },
  {
    title: "Be respectful",
    points: [
      "No harassment, threats, slurs or hateful language. Messages with slurs or threats are not delivered.",
      "No sexual or otherwise inappropriate messages.",
      "Honest, direct feedback is welcome. Personal attacks are not.",
    ],
  },
  {
    title: "Be reliable",
    points: [
      "Mentors reply within 24 hours, deliver by the due date and show up to booked calls.",
      "Students give mentors what they need (drafts, deadlines, context) and show up to booked calls.",
    ],
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <div className="page-narrow stack-lg">
      <div className="stack-sm">
        <h1 className="page-title">Community Guidelines</h1>
        <p className="lede">MentorsMD works because students can trust their mentors and mentors can trust their students. These rules apply to everyone.</p>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.title} className="stack-sm">
          <h2 style={{ fontSize: 26 }}>{s.title}</h2>
          <ul className="stack-sm text-secondary" style={{ paddingLeft: 20, lineHeight: 1.6 }}>
            {s.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </section>
      ))}
      <section className="card card-tint stack-sm">
        <h2 style={{ fontSize: 22 }}>The mentor agreement</h2>
        <p className="text-secondary">Every mentor accepts this when they join and each time they publish a package:</p>
        <ul className="stack-sm text-secondary" style={{ paddingLeft: 20, lineHeight: 1.6 }}>
          {MENTOR_AGREEMENT_POINTS.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </section>
      <section className="stack-sm">
        <h2 style={{ fontSize: 26 }}>How we keep MentorsMD safe</h2>
        <p className="text-secondary" style={{ lineHeight: 1.6 }}>
          Messages, files and delivery notes are checked automatically for things like slurs, threats, off-site payment, ghostwriting
          requests and requests for passwords, and our team may review conversations when something is flagged or reported. Breaking these
          guidelines can lead to a warning, a paused account or removal from MentorsMD. See our <Link href="/terms" className="link">Terms</Link> and{" "}
          <Link href="/privacy" className="link">Privacy Policy</Link>.
        </p>
        <p className="text-secondary" style={{ lineHeight: 1.6 }}>
          See something wrong? Use <b>Report</b> in the conversation or on the person&apos;s profile, or <Link href="/contact" className="link">contact us</Link>. More in our{" "}
          <Link href="/safety" className="link">safety tips</Link>.
        </p>
      </section>
    </div>
  );
}
