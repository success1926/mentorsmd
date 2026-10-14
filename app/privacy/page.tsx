import { currentDoc } from "@/lib/legal";
import { LegalBody, LegalHeader } from "@/components/LegalBody";
import { RECORDING_RETENTION_DAYS } from "@/lib/calls";

// Once a version is published in Admin -> Legal, it replaces the built-in
// text below (#99, #103).
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const doc = await currentDoc("PRIVACY");
  if (doc) {
    return (
      <div className="page-narrow">
        <LegalHeader title={doc.title} version={doc.version} publishedAt={doc.publishedAt} />
        <LegalBody body={doc.body} />
      </div>
    );
  }
  return <BuiltInPrivacyPage />;
}

function BuiltInPrivacyPage() {
  return (
    <div className="page-narrow">
      <h1 className="page-title" style={{ marginBottom: 12, textAlign: "left" }}>Privacy Policy</h1>
      <p className="text-muted" style={{ marginBottom: 28 }}>
        Placeholder text - this is not a real legal document. Have an actual lawyer draft or review your real
        Privacy Policy before launching publicly. Given that this site handles payment info (via Stripe) and
        messages between users, get this reviewed properly rather than relying on a template.
      </p>

      <div className="prose" style={{ display: "grid", gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>1. What we collect</h2>
          <p className="text-secondary">
            Account information (name, email), messages sent through the site, and booking/payment records.
            Payment card details are handled entirely by Stripe and never touch our servers directly.
          </p>
          <p className="text-secondary">
            To understand how the site is used, we keep a private log of visits, which mentor profiles are viewed and what is searched
            on Find a mentor, and we note how you first found us (for example the website that linked to us). This uses two of our own
            cookies (a random browser id and the first-visit source), no advertising trackers, and only the
            MentorsMD team can see it. Entries are deleted after about 13 months. We also use PostHog for product analytics (see below).
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>2. Third-party services we use</h2>
          <p className="text-secondary">
            Stripe (payments), Daily.co (video calls), Supabase (file storage and real-time messaging), Resend (email notifications), Sentry (error reports),
            PostHog (product analytics), and our database host. Each has its own privacy practices governing the data that passes through them.
          </p>
          <p className="text-secondary">
            PostHog shows us which pages are visited and clicked, using a cookie. If you are logged in it receives only your internal account id
            and whether you are a student or mentor, never your name, email or date of birth. Anything typed into forms is masked. Short
            screen recordings are made only on public pages (such as the homepage and mentor profiles) for visitors who are not logged in; we
            never record messages, orders, calls or account pages. Turning on &quot;Do Not Track&quot; in your browser switches PostHog off.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>3. Video calls, recordings and calendars</h2>
          <p className="text-secondary">
            Calls run on Daily.co in private rooms. Calls may be recorded; recordings are stored by Daily.co, can only be
            watched by the MentorsMD team when there is a problem with an order, and are deleted {RECORDING_RETENTION_DAYS} days after the
            order is closed. We log when each person joined and left a call. We store your time zone to send call
            reminders. If a mentor connects their own calendar, we read only the busy times from it (not event names)
            to hide those times from booking.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>4. Safety checks and message review</h2>
          <p className="text-secondary">
            Messages, file names, package descriptions and delivery notes are checked automatically for safety (threats, slurs, off-site
            payment, ghostwriting, requests for passwords and unsafe links). Some checks use outside services: Anthropic (an AI safety check),
            Google Safe Browsing (links) and Google reCAPTCHA (sign-up and login forms). When something is flagged or reported, MentorsMD staff
            may read the conversation and files involved. We keep a record of flags, reports and the actions our team takes. We store a
            scrambled (hashed) version of your IP address, not the address itself, to limit spam and abuse.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>5. How we use your information</h2>
          <p className="text-secondary">
            [Placeholder - describe your actual use: facilitating bookings, sending notifications, fraud
            prevention, etc.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>6. Your rights</h2>
          <p className="text-secondary">
            [Placeholder - if you have users in the EU/UK or California, this section has specific legal
            requirements (GDPR/CCPA) that a generic placeholder won't satisfy - get this reviewed.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>7. Contact us</h2>
          <p className="text-secondary">
            Questions about this policy can be sent through our <a href="/contact" style={{ textDecoration: "underline" }}>contact page</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
