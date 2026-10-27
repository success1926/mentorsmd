import { fetchWithTimeout } from "@/lib/request";
import { warnOnce } from "@/lib/warnOnce";

// A copy of every form submission in a Google Sheet, one tab per form
// (Contact messages, Waitlist, Mentor applications). The site's own
// records (Admin -> Leads) stay the real ones; the Sheet is a convenience
// for the team.
//
// Turned on by GOOGLE_SHEET_WEBHOOK_URL + GOOGLE_SHEET_SECRET (setup steps:
// docs/google-sheet-setup.md). The small Google script that receives the
// rows is scripts/google-sheet-apps-script.gs. Off when either is missing.
// Run it with runAfterResponse (lib/request.ts): it never slows down or
// fails a submission, and problems only go to the logs.

export const SHEET_TABS = {
  contact: "Contact messages",
  waitlist: "Waitlist",
  application: "Mentor applications",
} as const;

// Google Sheets treats anything starting with = + - @ (or a tab/return
// before one) as a formula, which a form could abuse (for example to send
// other rows to an outside website). A leading ' makes it plain text.
export function sheetSafe(row: Record<string, string | null | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => {
      const text = String(v ?? "").slice(0, 5000);
      return [k, /^[=+\-@\t\r]/.test(text) ? `'${text}` : text];
    })
  );
}

export async function logToSheet(tab: string, row: Record<string, string | null | undefined>): Promise<boolean> {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  const secret = process.env.GOOGLE_SHEET_SECRET;
  if (!url || !secret) {
    warnOnce("google-sheet", "GOOGLE_SHEET_WEBHOOK_URL / GOOGLE_SHEET_SECRET are not set - form submissions aren't copied to the Google Sheet.");
    return false;
  }
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, tab, row: sheetSafe(row) }),
        // Google answers with a redirect to the script's reply.
        redirect: "follow",
      },
      10_000
    );
    if (!res.ok) throw new Error(`Google Sheet answered ${res.status}`);
    const reply = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (reply && reply.ok === false) throw new Error(`Google Sheet script said: ${reply.error || "not ok"}`);
    return true;
  } catch (err) {
    console.error(`Couldn't copy a form submission to the Google Sheet tab "${tab}":`, err);
    return false;
  }
}
