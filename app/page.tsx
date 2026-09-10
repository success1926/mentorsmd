import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { TrustpilotWidget } from "@/components/TrustpilotWidget";
import { FAQ } from "@/components/FAQ";
import { StudentSpotlight } from "@/components/StudentSpotlight";
import { Testimonials } from "@/components/Testimonials";
import { MentorSpotlight } from "@/components/MentorSpotlight";

export const dynamic = "force-dynamic"; // mentor spotlight reads live data, never cache a stale build

export default async function HomePage() {
  return (
    <div>
      {/* --- Hero: the search bar is the main event here --- */}
      <div style={{ textAlign: "center", padding: "48px 0 40px" }}>
        <h1 style={{ fontSize: 30, lineHeight: 1.2, marginBottom: 14 }}>
          Get coached by someone who's already been through it
        </h1>
        <p className="text-secondary" style={{ fontSize: 16, maxWidth: 480, margin: "0 auto 32px" }}>
          {/* Placeholder copy - replace with your real pitch */}
          Book one-on-one time with vetted med students and resident physicians for
          essay reviews, mock interviews, and application coaching.
        </p>

        <div style={{ maxWidth: 560, margin: "0 auto 16px" }}>
          <SearchBar target="/coaches" large placeholder="Search our mentors" />
        </div>

        <Link href="/coaches" className="text-secondary" style={{ textDecoration: "underline" }}>
          or browse the full list
        </Link>
      </div>

      {/* --- Trustpilot --- */}
      <div style={{ maxWidth: 320, margin: "0 auto 48px" }}>
        <TrustpilotWidget />
      </div>

      {/* --- About / value props - replace this section with your own copy --- */}
      <div style={{ display: "grid", gap: 20, marginBottom: 40 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Every coach is vetted</div>
          <p className="text-secondary" style={{ lineHeight: 1.6 }}>
            Coaches can't sign up on their own - every profile on this site was
            personally reviewed and invited by us.
          </p>
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Pay only when you're satisfied</div>
          <p className="text-secondary" style={{ lineHeight: 1.6 }}>
            Payment is held securely until you confirm the work is done - your
            coach is paid the moment you release it.
          </p>
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Message and video call, all in one place</div>
          <p className="text-secondary" style={{ lineHeight: 1.6 }}>
            No juggling emails or third-party apps - everything happens right
            here, from your first message through your video session.
          </p>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <Link href="/coaches" className="btn" style={{ background: "#1E5631", border: "none", color: "#fff", padding: "12px 24px" }}>
          Find your coach
        </Link>
      </div>

      {/* --- Student highlights, testimonials, and a few real mentors - all above the FAQ --- */}
      <StudentSpotlight />
      <Testimonials />
      <MentorSpotlight />

      {/* --- FAQ --- */}
      <FAQ />
    </div>
  );
}
