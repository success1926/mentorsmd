import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/request";
import { LEGAL_INFO, LEGAL_KINDS, requiredKindsFor, type LegalKind } from "@/lib/legalKinds";
import { DEFAULT_LEGAL_TEXT } from "@/lib/legalDefaults";
import { MENTOR_AGREEMENT_VERSION } from "@/lib/agreement";

// Legal documents and acceptance records (#99-#103, #105).
//
//  - Each document has versions, edited and published in Admin -> Legal.
//  - A MAJOR change means everyone accepts again (the blocking screen,
//    components/AccountGate.tsx). A MINOR change doesn't: acceptances of
//    earlier versions still count.
//  - The requirement switches on only once version 1 of a document is
//    published (#103). Until then, the existing built-in page is shown and
//    acceptances are recorded as version 0.

export type PublishedDoc = {
  id: string;
  kind: LegalKind;
  version: number;
  title: string;
  body: string;
  changeType: string;
  changeNote: string | null;
  publishedAt: Date | null;
  requiredVersion: number; // the latest MAJOR version (or 1)
};

// Published documents rarely change, so they're cached for a short time
// on each server instance. Publishing clears the cache on that instance.
let cache: { at: number; docs: Map<LegalKind, PublishedDoc> } | null = null;
const CACHE_MS = 30_000;

export function clearLegalCache() {
  cache = null;
}

export async function publishedDocs(): Promise<Map<LegalKind, PublishedDoc>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.docs;
  const rows = await prisma.legalDocument.findMany({
    where: { status: "PUBLISHED", version: { not: null } },
    orderBy: [{ kind: "asc" }, { version: "desc" }],
    select: { id: true, kind: true, version: true, title: true, body: true, changeType: true, changeNote: true, publishedAt: true },
  });
  const docs = new Map<LegalKind, PublishedDoc>();
  for (const kind of LEGAL_KINDS) {
    const versions = rows.filter((r) => r.kind === kind);
    if (!versions.length) continue;
    const latest = versions[0];
    const required = versions.find((v) => v.changeType === "MAJOR" || v.version === 1)?.version ?? 1;
    docs.set(kind, { ...latest, kind, version: latest.version!, requiredVersion: required });
  }
  cache = { at: Date.now(), docs };
  return docs;
}

// What a public page shows: the latest published version, or null (the
// page then shows its built-in text).
export async function currentDoc(kind: LegalKind): Promise<PublishedDoc | null> {
  try {
    return (await publishedDocs()).get(kind) || null;
  } catch (err) {
    console.error("Couldn't load a legal document:", err);
    return null;
  }
}

// The text to show for a document: published version, else the built-in one.
export async function docOrDefault(kind: LegalKind): Promise<{ version: number; title: string; body: string | null; publishedAt: Date | null }> {
  const doc = await currentDoc(kind);
  if (doc) return { version: doc.version, title: doc.title, body: doc.body, publishedAt: doc.publishedAt };
  const d = DEFAULT_LEGAL_TEXT[kind];
  return { version: 0, title: d?.title || LEGAL_INFO[kind].label, body: d?.body ?? null, publishedAt: null };
}

export type PendingDoc = { kind: LegalKind; label: string; path: string; version: number; title: string; changeNote: string | null; firstTime: boolean };

// The documents this person still has to accept (empty = nothing to do).
export async function pendingLegal(user: { id: string; role: string }): Promise<PendingDoc[]> {
  const kinds = requiredKindsFor(user.role);
  if (!kinds.length) return [];
  const docs = await publishedDocs();
  const live = kinds.map((k) => docs.get(k)).filter((d): d is PublishedDoc => !!d);
  if (!live.length) return [];
  const accepted = await prisma.legalAcceptance.groupBy({
    by: ["kind"],
    where: { userId: user.id, kind: { in: live.map((d) => d.kind) } },
    _max: { version: true },
  });
  const best = new Map(accepted.map((a) => [a.kind, a._max.version ?? -1]));
  return live
    .filter((d) => (best.get(d.kind) ?? -1) < d.requiredVersion)
    .map((d) => ({
      kind: d.kind,
      label: LEGAL_INFO[d.kind].label,
      path: LEGAL_INFO[d.kind].path,
      version: d.version,
      title: d.title,
      changeNote: (best.get(d.kind) ?? -1) >= 0 ? d.changeNote : null,
      firstTime: (best.get(d.kind) ?? -1) < 0,
    }));
}

// The browser and IP an acceptance came from (kept with the record).
export function requestMeta(req: Request | null | undefined) {
  if (!req) return { ip: null, userAgent: null };
  return {
    ip: clientIp(req) || null,
    userAgent: (req.headers.get("user-agent") || "").slice(0, 500) || null,
  };
}

// Records that this person accepted the current version of each document.
export async function recordAcceptances(
  user: { id: string; email: string },
  kinds: LegalKind[],
  context: string,
  meta: { ip: string | null; userAgent: string | null },
  signerName?: string | null
) {
  if (!kinds.length) return;
  const docs = await publishedDocs();
  await prisma.legalAcceptance.createMany({
    data: kinds.map((kind) => {
      const doc = docs.get(kind);
      return {
        kind,
        version: doc?.version ?? 0,
        documentId: doc?.id ?? null,
        context,
        email: user.email,
        signerName: signerName?.slice(0, 200) || null,
        ip: meta.ip,
        userAgent: meta.userAgent,
        userId: user.id,
      };
    }),
  });
}

// Version numbers for showing "v3" next to a checkbox (0 = built-in text).
export async function currentVersions(): Promise<Record<LegalKind, number>> {
  const docs = await publishedDocs().catch(() => new Map<LegalKind, PublishedDoc>());
  return Object.fromEntries(LEGAL_KINDS.map((k) => [k, docs.get(k)?.version ?? 0])) as Record<LegalKind, number>;
}

// The mentor agreement version stored on a mentor and on each package:
// "v3" once versions are published in Admin -> Legal, else the date of the
// built-in agreement (lib/agreement.ts).
export async function mentorAgreementLabel(): Promise<string> {
  const doc = await currentDoc("MENTOR_AGREEMENT");
  return doc ? `v${doc.version}` : MENTOR_AGREEMENT_VERSION;
}
