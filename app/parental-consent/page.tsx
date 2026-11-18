import { docOrDefault } from "@/lib/legal";
import { LegalBody, LegalHeader } from "@/components/LegalBody";

export const metadata = { alternates: { canonical: "/parental-consent" }, title: "Parental Consent", description: "How parents and guardians give consent for students aged 13 to 17 on MentorsMD." };

// The latest version published in Admin -> Legal, or the built-in text in
// lib/legalDefaults.ts (drafted Nov 18, 2026, to be reviewed by a lawyer
// and then published from Admin -> Legal).
export const dynamic = "force-dynamic";

export default async function ParentalConsentPage() {
  const doc = await docOrDefault("PARENTAL_CONSENT");
  return (
    <div className="page-narrow">
      <LegalHeader title={doc.title} version={doc.version} publishedAt={doc.publishedAt} />
      {doc.body && <LegalBody body={doc.body} />}
    </div>
  );
}
