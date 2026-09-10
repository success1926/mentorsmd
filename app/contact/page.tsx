// Placeholder contact info - replace with your real phone number and inbox.
const PHONE = "(555) 123-4567";
const EMAIL = "hello@mentorsmd.com";

export default function ContactPage() {
  return (
    <div>
      <h1 style={{ fontSize: 26, textAlign: "center", marginBottom: 8 }}>Contact us</h1>
      <p className="text-secondary" style={{ textAlign: "center", maxWidth: 440, margin: "0 auto 36px" }}>
        Have a question, ran into an issue, or just want to talk to a real person? Reach out any of these ways.
      </p>

      <div style={{ maxWidth: 400, margin: "0 auto", display: "grid", gap: 12 }}>
        <a href={`tel:${PHONE.replace(/[^\d+]/g, "")}`} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: 18, background: "#1E5631" }}>📞</div>
          <div>
            <div className="text-secondary" style={{ marginBottom: 2 }}>Call us</div>
            <div style={{ fontWeight: 600 }}>{PHONE}</div>
          </div>
        </a>

        <a href={`mailto:${EMAIL}`} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: 18, background: "#7C3AED" }}>✉️</div>
          <div>
            <div className="text-secondary" style={{ marginBottom: 2 }}>Email us</div>
            <div style={{ fontWeight: 600 }}>{EMAIL}</div>
          </div>
        </a>
      </div>
    </div>
  );
}
