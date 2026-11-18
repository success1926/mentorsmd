import { docOrDefault } from "@/lib/legal";
import { LegalBody, LegalHeader } from "@/components/LegalBody";

export const metadata = { alternates: { canonical: "/terms" }, title: "Terms of Service", description: "The terms for using MentorsMD as a student, parent or mentor." };

// The latest version published in Admin -> Legal, or the built-in text in
// lib/legalDefaults.ts (drafted Nov 18, 2026, to be reviewed by a lawyer
// and then published from Admin -> Legal).
export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const doc = await docOrDefault("TERMS");
  return (
    <div className="page-narrow">
      <LegalHeader title={doc.title} version={doc.version} publishedAt={doc.publishedAt} />
      {doc.body && <LegalBody body={doc.body} />}
    </div>
  );
}
