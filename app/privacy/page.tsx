export default function PrivacyPage() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Privacy Policy</h1>
      <p className="text-muted" style={{ marginBottom: 28 }}>
        Placeholder text - this is not a real legal document. Have an actual lawyer draft or review your real
        Privacy Policy before launching publicly. Given that this site handles payment info (via Stripe) and
        messages between users, get this reviewed properly rather than relying on a template.
      </p>

      <div style={{ display: "grid", gap: 20, lineHeight: 1.7 }}>
        <div>
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>1. What we collect</h2>
          <p className="text-secondary">
            Account information (name, email), messages sent through the site, and booking/payment records.
            Payment card details are handled entirely by Stripe and never touch our servers directly.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>2. Third-party services we use</h2>
          <p className="text-secondary">
            Stripe (payments), Daily.co (video calls), Pusher (real-time messaging), Resend (email notifications),
            and our database host. Each has its own privacy practices governing the data that passes through them.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>3. How we use your information</h2>
          <p className="text-secondary">
            [Placeholder - describe your actual use: facilitating bookings, sending notifications, fraud
            prevention, etc.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>4. Your rights</h2>
          <p className="text-secondary">
            [Placeholder - if you have users in the EU/UK or California, this section has specific legal
            requirements (GDPR/CCPA) that a generic placeholder won't satisfy - get this reviewed.]
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>5. Contact us</h2>
          <p className="text-secondary">
            Questions about this policy can be sent through our <a href="/contact" style={{ textDecoration: "underline" }}>contact page</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
