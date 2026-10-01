import Link from "next/link";
import { Icon, ICONS, Vetted } from "@/components/ui";

export const metadata = { title: "Become a mentor · MentorsMD" };

const PERKS = [
  { title: "Set your own packages", body: "Choose what you offer, your price and your turnaround. Pause any time.", icon: ICONS.pen },
  { title: "Get paid reliably", body: "Students pay up front. We hold it and release it to you when the work is approved.", icon: ICONS.lock },
  { title: "Calls on your calendar", body: "Connect Cal.com and students book calls in your open times, only after they've paid.", icon: ICONS.calendar },
];

export default function BecomeMentorPage() {
  return (
    <div className="page-mid">
      <div className="stack-lg">
        <div className="stack" style={{ gap: 18 }}>
          <Vetted />
          <h1 className="page-title">Mentor the next class of doctors.</h1>
          <p className="lede">
            MentorsMD is invite-only. Every mentor is reviewed by our senior team before they receive an invite, so students know anyone they message has real admissions experience.
          </p>
        </div>

        <div className="grid-3">
          {PERKS.map((p) => (
            <div key={p.title} className="card card-tint stack-sm" style={{ gap: 10 }}>
              <span className="icon-dot" style={{ background: "#fff" }}><Icon d={p.icon} /></span>
              <b style={{ fontSize: 18 }}>{p.title}</b>
              <span className="text-secondary">{p.body}</span>
            </div>
          ))}
        </div>

        <div className="card stack" style={{ gap: 14 }}>
          <h2 style={{ fontSize: 30 }}>How to join</h2>
          <ol className="stack-sm" style={{ margin: 0, paddingLeft: 20, fontSize: 16, lineHeight: 1.6 }}>
            <li>Tell us about yourself: your school, year, and what you&apos;d like to help with.</li>
            <li>Our senior team reviews your background and admissions experience.</li>
            <li>If you&apos;re a fit, we email you a one-time invite link to set up your profile.</li>
          </ol>
          <div className="row-wrap">
            <Link href="/contact?topic=mentor" className="btn btn-primary btn-lg">Apply to mentor</Link>
            <span className="text-secondary">Already have an invite? Open the link in your invite email.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
