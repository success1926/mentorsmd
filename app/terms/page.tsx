import { currentDoc } from "@/lib/legal";
import { LegalBody, LegalHeader } from "@/components/LegalBody";
import { RECORDING_RETENTION_DAYS } from "@/lib/calls";

// Once a version is published in Admin -> Legal, it replaces the built-in
// text below (#99, #103).
export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const doc = await currentDoc("TERMS");
  if (doc) {
    return (
      <div className="page-narrow">
        <LegalHeader title={doc.title} version={doc.version} publishedAt={doc.publishedAt} />
        <LegalBody body={doc.body} />
      </div>
    );
  }
  return <BuiltInTermsPage />;
}

function BuiltInTermsPage() {
  return (
    <div className="page-narrow">
      <h1 className="page-title" style={{ marginBottom: 12, textAlign: "left" }}>Terms of Service</h1>
      <p className="text-muted" style={{ marginBottom: 28 }}>
        Placeholder text - this is not a real legal document. Have an actual lawyer draft or review your real
        Terms of Service before launching publicly, especially given the payment escrow and marketplace
        mechanics this site involves.
      </p>

      <div className="prose" style={{ display: "grid", gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>1. What this site does</h2>
          <p className="text-secondary">
            MentorsMD connects students ("students") with invited mentors ("mentors") for paid coaching sessions.
            Mentors are personally vetted and invited; students may sign up freely.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>2. Payments and escrow</h2>
          <p className="text-secondary">
            Payment is collected at booking and held until the student approves the work, at which point
            it is released to the mentor minus a platform fee. [Placeholder - describe your actual refund window,
            dispute process, and fee percentage here.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>3. Video calls and recordings</h2>
          <p className="text-secondary">
            Calls included in a package take place in a private MentorsMD video room that only the student and mentor on
            the order can join. Calls may be recorded for safety and quality. Recordings are only watched by the MentorsMD
            team when there is a problem with an order (for example a dispute or a missed call), are never shared with
            the other person or anyone else, and are deleted {RECORDING_RETENTION_DAYS} days after the order is closed. We also keep a
            record of when each person joined and left a call. By joining a call, you agree to this.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>4. Safety reviews of messages</h2>
          <p className="text-secondary">
            To keep MentorsMD safe and honest, messages, file names, package descriptions and delivery notes are checked automatically
            (including by an AI service) for things like threats, slurs, payment outside MentorsMD, ghostwriting and requests for passwords.
            Messages with slurs or threats may not be delivered. When something is flagged or reported, the MentorsMD team may read the
            conversation and the files involved. Breaking the <a href="/community-guidelines" style={{ textDecoration: "underline" }}>Community Guidelines</a> can
            lead to a warning, a paused account or removal. Mentors also accept the mentor agreement described there. [Placeholder - have a lawyer review.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>4a. Age and students under 18</h2>
          <p className="text-secondary">
            You must be at least 13 to use MentorsMD. Students aged 13 to 17 need a parent or legal guardian to consent (see the{" "}
            <a href="/parental-consent" style={{ textDecoration: "underline" }}>Parental Consent form</a>) before they can message mentors or book packages.
            Their parent or guardian receives a receipt for every order and can see their order and call history. Mentors can see that a student is under 18
            and may choose not to work with students under 18. [Placeholder - have a lawyer review.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>5. Account responsibilities</h2>
          <p className="text-secondary">
            Users are responsible for the accuracy of information they provide and for maintaining the security of
            their account credentials. [Placeholder.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>6. Limitation of liability</h2>
          <p className="text-secondary">
            [Placeholder - this section typically needs the most careful legal drafting of any section here.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>7. Changes to these terms</h2>
          <p className="text-secondary">
            [Placeholder - describe how and when you'll notify users of changes.]
          </p>
        </div>
      </div>
    </div>
  );
}
