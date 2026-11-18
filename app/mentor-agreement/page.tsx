import { docOrDefault } from "@/lib/legal";
import { LegalBody, LegalHeader } from "@/components/LegalBody";

export const metadata = { alternates: { canonical: "/mentor-agreement" }, title: "Mentor Agreement", description: "The agreement every MentorsMD mentor accepts before working with students." };

// The latest version published in Admin -> Legal, or the built-in text in
// lib/legalDefaults.ts (drafted Nov 18, 2026, to be reviewed by a lawyer
// and then published from Admin -> Legal).
export const dynamic = "force-dynamic";

export default async function MentorAgreementPage() {
  const doc = await docOrDefault("MENTOR_AGREEMENT");
  return (
    <div className="page-narrow">
      <LegalHeader title={doc.title} version={doc.version} publishedAt={doc.publishedAt} />
      {doc.body && <LegalBody body={doc.body} />}
    </div>
  );
}
