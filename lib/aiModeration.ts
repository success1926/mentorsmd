import { warnOnce } from "@/lib/warnOnce";
import { fetchWithTimeout } from "@/lib/request";
import type { Severity } from "@/lib/moderation";

// Optional AI safety check on messages and delivery notes, using Claude
// (Anthropic Messages API) over plain fetch. It only ever CREATES ADMIN
// FLAGS - it never blocks or changes anything the person sent. It runs
// after the message is saved (see runAfterResponse), with a short time
// limit, so sending is never slowed down.
//
// Env: ANTHROPIC_API_KEY (from https://console.anthropic.com). Off when unset.

const MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 8000;

export type AiVerdict = { flag: boolean; category: string; severity: Severity; reason: string; quote: string };

const SYSTEM = `You review messages on MentorsMD, a marketplace where medical students and residents ("mentors") give paid feedback and coaching to pre-med "students" applying to medical school. Payments and calls must stay on MentorsMD. Mentors may give feedback and suggest edits, but must never write essays or applications for students, and nobody may ask for passwords or logins.

Decide if the text needs a human safety review. Flag ONLY clear problems:
- GHOSTWRITING: asking for or offering to write essays/applications for the student, or to take tests for them.
- CREDENTIALS: asking for or sharing passwords or login details (AMCAS, AACOMAS, TMDSAS, email...).
- OFF_SITE: trying to move payment or calls off MentorsMD (other payment apps, "pay me directly", phone/email to avoid the site).
- HARASSMENT: insults, threats, sexual content, discrimination.
- SCAM: fraud, guaranteed admission promises for money, phishing.
Normal coaching, frank feedback, medical vocabulary, mild swearing and scheduling are fine and must NOT be flagged.

Reply with JSON only, no other text:
{"flag": true|false, "category": "GHOSTWRITING|CREDENTIALS|OFF_SITE|HARASSMENT|SCAM|NONE", "severity": 1|2|3, "reason": "<one short sentence>", "quote": "<the exact problem words, max 120 characters>"}
severity: 3 = credentials, threats or clear fraud; 2 = clear ghostwriting or off-site payment; 1 = borderline.`;

export function aiModerationEnabled() {
  if (!process.env.ANTHROPIC_API_KEY) {
    warnOnce("anthropic", "ANTHROPIC_API_KEY is not set - the AI safety check on messages is off.");
    return false;
  }
  return true;
}

// Returns a verdict, or null when the check is off, times out or fails.
export async function aiReview(text: string, context: "message" | "delivery"): Promise<AiVerdict | null> {
  if (!aiModerationEnabled() || !text.trim()) return null;
  try {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Type: ${context === "delivery" ? "a mentor's delivery note on an order" : "a chat message"}\n<text>\n${text.slice(0, 4000)}\n</text>`,
          },
        ],
      }),
    }, TIMEOUT_MS);
    if (!res.ok) {
      console.error("AI safety check failed:", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const data: any = await res.json();
    if (data.stop_reason === "refusal") return null;
    const out = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
    const v = JSON.parse(json);
    if (!v || typeof v.flag !== "boolean") return null;
    const sev = Number(v.severity);
    return {
      flag: v.flag && v.category !== "NONE",
      category: String(v.category || "OTHER").slice(0, 30),
      severity: (sev === 3 ? 3 : sev === 2 ? 2 : 1) as Severity,
      reason: String(v.reason || "Flagged by the AI check").slice(0, 300),
      quote: String(v.quote || "").slice(0, 200),
    };
  } catch (err) {
    console.error("AI safety check failed:", err);
    return null;
  }
}
