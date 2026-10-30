import { docOrDefault } from "@/lib/legal";
import { LegalBody, LegalHeader } from "@/components/LegalBody";

export const metadata = { title: "Parental Consent", description: "How parents and guardians give consent for students aged 13 to 17 on MentorsMD." };

// The latest published version from Admin -> Legal, or the built-in text.
export const dynamic = "force-dynamic";

export default async function ParentalConsentPage() {
  const doc = await docOrDefault("PARENTAL_CONSENT");
  return (
    <div className="page-narrow">
      <LegalHeader title={doc.title} version={doc.version} publishedAt={doc.publishedAt} />
      {doc.version === 0 && (
        <p className="text-muted" style={{ marginBottom: 20 }}>Placeholder text - have a lawyer review it before launch.</p>
      )}
      {doc.body && <LegalBody body={doc.body} />}
    </div>
  );
}
