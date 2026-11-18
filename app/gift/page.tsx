import { prisma } from "@/lib/prisma";
import { isMentorListed } from "@/lib/mentor";
import { hoursLabel, offerMinutes, offerRate, priceFor } from "@/lib/pricing";
import { GiftForm, type GiftOffer } from "./GiftForm";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/gift" },
  title: "Gift Credit",
  description: "Buy MentorsMD credit or a mentor's package for your student. No account needed.",
};

// Gift MentorsMD (lib/gifts.ts): a parent or guardian, with no account,
// buys MentorsMD credit for their student, or (?offer=<id>, from
// "Buying for your student?" on a mentor's profile) that exact package.
export default async function GiftPage({ searchParams }: { searchParams: { offer?: string; cancelled?: string } }) {
  let offer: GiftOffer | null = null;
  let offerGone = false;
  if (searchParams.offer) {
    const gig = await prisma.gig.findUnique({
      where: { id: String(searchParams.offer).slice(0, 64) },
      include: { seller: { select: { id: true, name: true, hourlyRateCents: true, profileStatus: true, pausedUntil: true, safetyHoldAt: true, profileCompleteAt: true, role: true } } },
    });
    const rate = gig ? offerRate(gig, gig.seller.hourlyRateCents) : null;
    const minutes = gig ? offerMinutes(gig) : 0;
    if (gig && gig.active && gig.kind && ["HOURLY", "BUNDLE", "SPECIALIZED"].includes(gig.kind) && gig.seller.role === "SELLER" && isMentorListed(gig.seller) && rate && minutes) {
      offer = {
        id: gig.id,
        title: gig.kind === "HOURLY" ? `1 hour with ${gig.seller.name.split(" ")[0]}` : gig.title,
        mentorName: gig.seller.name,
        mentorId: gig.seller.id,
        hours: hoursLabel(minutes),
        priceCents: priceFor(minutes, rate),
      };
    } else {
      offerGone = true;
    }
  }

  return (
    <div className="page-wide stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">Gift MentorsMD</span>
        <h1 className="page-title" style={{ textAlign: "left" }}>{offer ? "Buy This Package for Your Student" : "Give MentorsMD Credit"}</h1>
        <p className="lede">
          {offer
            ? "Pay as a guest: no account needed. The package goes straight to your student's account, exactly as if they'd bought it."
            : "Pay as a guest: no account needed. Credit never expires, and your student can use it with any mentor, for calls or written feedback."}
        </p>
      </div>
      {searchParams.cancelled && <div role="status" className="alert">Checkout was closed, so nothing was charged. You can try again below.</div>}
      {offerGone && <div role="status" className="alert">That package isn&apos;t available any more. You can give MentorsMD credit instead.</div>}
      {/* Desktop: the form on the left; what the student receives and how it
          works on the right. Phones: one column. */}
      <div className="gift-grid">
        <GiftForm offer={offer} />
        <aside className="stack" style={{ gap: 20 }}>
          <div className="gift-preview" aria-hidden="true">
            <span className="gift-preview-eyebrow">MentorsMD</span>
            <span className="gift-preview-title">{offer ? "A package from someone in your corner" : "You've been given MentorsMD credit"}</span>
            <span className="gift-preview-body">{offer ? "Your package is ready in your account. Book your first call or send your first draft whenever you're ready." : "Use it with any vetted mentor, for calls or written feedback. It never expires."}</span>
            <span className="gift-preview-note">Your note to them shows here.</span>
          </div>
      <section className="card stack-sm">
        <h2 style={{ fontSize: 22 }}>How It Works</h2>
        <ol className="stack-sm" style={{ paddingLeft: 20, margin: 0 }}>
          <li>You pay by card on Stripe. Stripe emails you a receipt, and we email you a private page to see what you bought.</li>
          <li>We email your student. If they don&apos;t have a MentorsMD account yet, the email has a link to set one up.</li>
          <li>
            {offer
              ? "The package shows in their account; they book calls or send work with the mentor. Your page shows the hours used and calls held (never their messages)."
              : "The credit is applied automatically when they book with any mentor."}
          </li>
          <li>Students under 18 also need a parent or guardian&apos;s consent before they can use MentorsMD. We email that separately once they set up their account.</li>
        </ol>
      </section>
        </aside>
      </div>
    </div>
  );
}
