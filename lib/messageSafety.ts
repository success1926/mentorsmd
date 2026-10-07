import { checkText, WARNING_TEXT, type Finding, type WarningKind } from "@/lib/moderation";
import { NEW_ACCOUNT_LINK_HOURS, isShortener, outsideLinks, unsafeLinks } from "@/lib/links";
import { createFlag, createFlagsForFindings } from "@/lib/flags";
import { aiReview } from "@/lib/aiModeration";
import type { FlagKind } from "@/lib/moderation";

// The checks every new message goes through before it's saved (see
// /api/conversations/[id]/messages). Returns either a refusal for the
// sender, warnings to confirm, or the findings to flag after saving.

export type MessageVerdict =
  | { ok: false; status: number; error: string; code: string; warnings?: { kind: WarningKind; text: string }[] }
  | { ok: true; findings: Finding[] };

export async function checkOutgoingMessage(opts: {
  text: string;
  attachmentName: string | null;
  sender: { id: string; createdAt: Date };
  conversationId: string;
  acknowledgedWarnings: boolean;
}): Promise<MessageVerdict> {
  const { text, sender } = opts;
  const check = checkText(text, "message");

  // 1. Slurs and threats: never sent, and the attempt is flagged.
  if (check.blocked) {
    await createFlag({
      kind: "BLOCKED_MESSAGE",
      severity: check.blocked.reason === "Threat of violence" ? 3 : 2,
      reason: `Message blocked: ${check.blocked.reason.toLowerCase()}`,
      evidence: text,
      matches: check.blocked.matches,
      subjectUserId: sender.id,
      conversationId: opts.conversationId,
    });
    return { ok: false, status: 400, error: check.blocked.message, code: "BLOCKED" };
  }

  // 2. Links.
  const links = outsideLinks(text);
  if (links.length) {
    if (Date.now() - sender.createdAt.getTime() < NEW_ACCOUNT_LINK_HOURS * 3600_000) {
      return { ok: false, status: 400, error: "New accounts can't send links during their first day. Please describe it in words for now, or try again tomorrow.", code: "LINKS_NEW_ACCOUNT" };
    }
    const short = links.filter(isShortener);
    if (short.length) {
      return { ok: false, status: 400, error: `Shortened links (like ${short[0]}) aren't allowed because they hide where they go. Please paste the full link.`, code: "LINK_SHORTENER" };
    }
    const unsafe = await unsafeLinks(links);
    if (unsafe.length) {
      await createFlag({
        kind: "LINK",
        severity: 3,
        reason: "Tried to send a dangerous link (Google Safe Browsing)",
        evidence: text,
        matches: unsafe,
        subjectUserId: sender.id,
        conversationId: opts.conversationId,
      });
      return { ok: false, status: 400, error: "This message wasn't sent: Google lists one of its links as unsafe (malware or phishing).", code: "LINK_UNSAFE" };
    }
  }

  // 3. Off-site / ghostwriting / login details: the sender is warned first
  //    and can still send (the message is then flagged for review).
  if (check.warnings.length && !opts.acknowledgedWarnings) {
    return {
      ok: false,
      status: 422,
      error: "Please read this before sending.",
      code: "WARNING",
      warnings: Array.from(new Set(check.warnings)).map((kind) => ({ kind, text: WARNING_TEXT[kind] })),
    };
  }

  const findings = [...check.findings];
  if (opts.attachmentName) findings.push(...checkText(opts.attachmentName, "filename").findings);
  return { ok: true, findings };
}

// After the message is saved: flag what the word checks found.
export async function flagSavedMessage(findings: Finding[], m: { id: string; body: string; attachmentName: string | null; senderId: string; conversationId: string }) {
  if (!findings.length) return;
  await createFlagsForFindings(findings, {
    evidence: [m.body, m.attachmentName ? `[file: ${m.attachmentName}]` : ""].filter(Boolean).join("\n"),
    subjectUserId: m.senderId,
    conversationId: m.conversationId,
    messageId: m.id,
  });
}

const AI_KINDS: Record<string, FlagKind> = { GHOSTWRITING: "GHOSTWRITING", CREDENTIALS: "CREDENTIALS", OFF_SITE: "OFF_SITE" };

// The optional AI check (runs in the background after sending).
export async function aiCheckAndFlag(text: string, context: "message" | "delivery", base: { subjectUserId: string; conversationId?: string | null; messageId?: string | null; orderId?: string | null }) {
  if (text.trim().length < 12) return;
  const v = await aiReview(text, context);
  if (!v?.flag) return;
  await createFlag({
    kind: AI_KINDS[v.category] || "AI",
    source: "AI",
    severity: v.category === "CREDENTIALS" ? 3 : v.severity,
    reason: `AI check: ${v.reason}`,
    evidence: text,
    matches: v.quote ? [v.quote] : [],
    ...base,
    dedupeKey: `ai:${base.messageId || base.orderId}:${context}`,
  });
}

// Messages sent by someone on a safety hold, or with no confirmed email.
export async function senderBlockReason(sender: { role: string; safetyHoldAt: Date | null }) {
  if (sender.safetyHoldAt && sender.role === "BUYER") {
    return "Your account is paused while our team reviews it, so you can't send messages right now. Contact us if you have questions.";
  }
  return null;
}

