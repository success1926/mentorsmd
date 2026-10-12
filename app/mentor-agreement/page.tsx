import { docOrDefault } from "@/lib/legal";
import { LegalBody, LegalHeader } from "@/components/LegalBody";

// The latest published version from Admin -> Legal, or the built-in text.
export const dynamic = "force-dynamic";

export default async function MentorAgreementPage() {
  const doc = await docOrDefault("MENTOR_AGREEMENT");
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
