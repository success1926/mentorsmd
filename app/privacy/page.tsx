import { currentDoc } from "@/lib/legal";
import { LegalBody, LegalHeader } from "@/components/LegalBody";
import { RECORDING_RETENTION_DAYS } from "@/lib/calls";

export const metadata = { title: "Privacy Policy", description: "How MentorsMD collects, uses and protects your information." };

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
            Sentry receives technical error reports when something breaks. For errors in your browser we send only the page address
            (without anything after a &quot;?&quot;, and with private links and ids removed) and the kind of error, never what you typed or
            your name or email.
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
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>4. Google Calendar (for mentors)</h2>
          <p className="text-secondary">
            Mentors can choose to connect a Google Calendar so their busy times are hidden from students when booking. When a mentor
            connects, we ask Google only for permission to see free/busy times (the calendar.freebusy permission), plus the email address of
            the Google account, so we can show which account is connected. We read only when the mentor is busy or free on their main
            calendar: never event titles, descriptions, locations, attendees or any other calendar content. We use these busy times only to
            hide them from students when they book a call, and keep a short-lived copy of them for that purpose.
          </p>
          <p className="text-secondary">
            The permission Google gives us (a connection token) is stored encrypted. We don&apos;t sell or share this data, and we don&apos;t
            use it for advertising or to train AI models. A mentor can disconnect at any time on Account → Call availability, which tells
            Google to remove the permission and deletes the stored token and busy times. You can also remove access from your Google
            account at{" "}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>myaccount.google.com/permissions</a>;
            we then can no longer read your calendar, and disconnecting on Account deletes the stored token.
          </p>
          <p className="text-secondary">
            MentorsMD&apos;s use and transfer of information received from Google APIs will adhere to the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>Google API Services User Data Policy</a>,
            including the Limited Use requirements.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>5. Safety checks and message review</h2>
          <p className="text-secondary">
            Messages, file names, package descriptions and delivery notes are checked automatically for safety (threats, slurs, off-site
            payment, ghostwriting, requests for passwords and unsafe links). Some checks use outside services: Anthropic (an AI safety check),
            Google Safe Browsing (links) and Google reCAPTCHA (sign-up and login forms). When something is flagged or reported, MentorsMD staff
            may read the conversation and files involved. We keep a record of flags, reports and the actions our team takes. We store a
            scrambled (hashed) version of your IP address, not the address itself, to limit spam and abuse.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>6. How we use your information</h2>
          <p className="text-secondary">
            [Placeholder - describe your actual use: facilitating bookings, sending notifications, fraud
            prevention, etc.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>7. Your rights</h2>
          <p className="text-secondary">
            [Placeholder - if you have users in the EU/UK or California, this section has specific legal
            requirements (GDPR/CCPA) that a generic placeholder won't satisfy - get this reviewed.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>8. Contact us</h2>
          <p className="text-secondary">
            Questions about this policy can be sent through our <a href="/contact" style={{ textDecoration: "underline" }}>contact page</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
