import { Icon, ICONS, Vetted } from "@/components/ui";
import { MentorApplicationForm } from "@/components/MentorApplicationForm";

export const metadata = { title: "Become a mentor · MentorsMD" };

const PERKS = [
  { title: "Set your own packages", body: "Choose what you offer, your price and your turnaround. Pause any time.", icon: ICONS.pen },
  { title: "Get paid reliably", body: "Students pay up front. We hold it and release it to you when the work is approved.", icon: ICONS.lock },
  { title: "Calls on your calendar", body: "Set your weekly hours once. Students book calls in your open times, only after they've paid, and calls happen in a private MentorsMD video room.", icon: ICONS.calendar },
];

// The application form sits on this page (#apply); the old
// /become-a-mentor/apply address redirects here (next.config.js).
export default function BecomeMentorPage() {
  return (
    <div className="page-mid">
      <div className="stack-lg">
        <div className="stack" style={{ gap: 18 }}>
          <Vetted />
          <h1 className="page-title">Mentor the next class of doctors.</h1>
          <p className="lede">
            MentorsMD is invite-only. Every mentor goes through a rigorous interview with each of our senior team members before they receive an invite, so students know anyone they message has real experience and outstanding results.
          </p>
          <div className="row-wrap">
            <a href="#apply" className="btn btn-primary btn-lg">Apply to mentor</a>
          </div>
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
            <li>Fill in the short application below: your medical school, residency if you have one, your resume and a few lines about yourself.</li>
            <li>If your application looks like a fit, you interview with each of our senior team members.</li>
            <li>After the interviews, if you&apos;re a fit, we email you a one-time invite link to set up your profile.</li>
          </ol>
          <div className="row-wrap">
            <a href="#apply" className="btn btn-primary btn-lg">Apply to mentor</a>
            <span className="text-secondary">Already have an invite? Open the link in your invite email.</span>
          </div>
        </div>

        <section id="apply" className="stack" style={{ gap: 14, scrollMarginTop: 150 }}>
          <h2 style={{ fontSize: 36 }}>Apply to mentor</h2>
          <p className="lede">
            Tell us a little about yourself. Our senior team reviews every application and usually replies within a few days.
          </p>
          <div style={{ maxWidth: 720, width: "100%" }}>
            <MentorApplicationForm />
          </div>
        </section>
      </div>
    </div>
  );
}
