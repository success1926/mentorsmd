export default function TermsPage() {
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
            Mentors are personally vetted and invited; buyers may sign up freely.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>2. Payments and escrow</h2>
          <p className="text-secondary">
            Payment is collected at booking and held until the buyer confirms the work is complete, at which point
            it is released to the mentor minus a platform fee. [Placeholder - describe your actual refund window,
            dispute process, and fee percentage here.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>3. Account responsibilities</h2>
          <p className="text-secondary">
            Users are responsible for the accuracy of information they provide and for maintaining the security of
            their account credentials. [Placeholder.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>4. Limitation of liability</h2>
          <p className="text-secondary">
            [Placeholder - this section typically needs the most careful legal drafting of any section here.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>5. Changes to these terms</h2>
          <p className="text-secondary">
            [Placeholder - describe how and when you'll notify users of changes.]
          </p>
        </div>
      </div>
    </div>
  );
}
