import Link from "next/link";
import { consentByToken } from "@/lib/minors";
import { docOrDefault } from "@/lib/legal";
import { LegalBody } from "@/components/LegalBody";
import { ConsentForm } from "./ConsentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parental consent · MentorsMD", robots: { index: false } };

// The page a parent or guardian opens from the consent email (#108): the
// Terms and the Parental Consent form, then a typed full name as their
// e-signature. The link works for 7 days.
export default async function ConsentPage({ params }: { params: { token: string } }) {
  const consent = await consentByToken(params.token);
  const valid = consent && consent.status === "PENDING" && consent.expiresAt > new Date() && !!consent.user.minorStatus;

  if (!valid) {
    const done = consent?.status === "CONSENTED";
    return (
      <div className="page-narrow">
        <div className="card-narrow stack">
          <h1 className="page-title" style={{ fontSize: 34 }}>{done ? "Consent already given" : "This link isn't valid any more"}</h1>
          <p className="text-secondary">
            {done
              ? "Thank you, your consent is already recorded. We emailed you a private link to see your student's orders and calls."
              : "Consent links work for 7 days and only the newest one works. Ask your student to send a new one from their MentorsMD account, or contact us."}
          </p>
          <Link href="/contact" className="link">Contact us</Link>
        </div>
      </div>
    );
  }

  const [terms, form] = await Promise.all([docOrDefault("TERMS"), docOrDefault("PARENTAL_CONSENT")]);
  const age = consent.user.dateOfBirth ? Math.floor((Date.now() - consent.user.dateOfBirth.getTime()) / (365.25 * 86400_000)) : null;

  return (
    <div className="page-narrow stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">For parents and guardians</span>
        <h1 className="page-title" style={{ textAlign: "left" }}>Consent for {consent.user.name}</h1>
        <p className="lede">
          {consent.user.name}{age !== null ? ` (age ${age})` : ""} created a student account on MentorsMD and listed you, {consent.parentName}, as their parent or guardian.
          Please read the form and our Terms, then sign below.
        </p>
      </div>

      <section className="card stack">
        <h2 style={{ fontSize: 26 }}>{form.title}{form.version > 0 ? ` (version ${form.version})` : ""}</h2>
        {form.body && <LegalBody body={form.body} />}
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: 26 }}>{terms.title}{terms.version > 0 ? ` (version ${terms.version})` : ""}</h2>
        {terms.body ? (
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            <LegalBody body={terms.body} />
          </div>
        ) : (
          <p className="text-secondary">
            Read the <Link href="/terms" target="_blank" className="link">Terms of Service</Link> and <Link href="/privacy" target="_blank" className="link">Privacy Policy</Link> (they open in a new tab).
          </p>
        )}
      </section>

      <ConsentForm token={params.token} studentName={consent.user.name} expiresAt={consent.expiresAt.toISOString()} />
    </div>
  );
}
