import { prisma } from "@/lib/prisma";
import { continuePage } from "@/lib/continuePage";
import { checkRemindersOffSig } from "@/lib/scheduledEmails";

export const dynamic = "force-dynamic";

// The "Stop these reminders" link at the bottom of every reminder email
// (lib/scheduledEmails.ts). Signed, so it only works for the person it was
// sent to. Opening it only shows a button (lib/continuePage.ts), so a link
// preview or email scanner can't turn reminders off by itself.
const BAD = { title: "This link doesn't work", text: "The link may have been cut off. Copy the whole link from the email, or reply to the email and we'll turn reminders off for you." };

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!checkRemindersOffSig(url.searchParams.get("u"), url.searchParams.get("sig"))) return continuePage(BAD);
  return continuePage({
    title: "Stop reminder emails",
    text: "We'll stop sending you reminders (like an unfinished checkout or an unfinished profile). Emails about your orders, calls and messages will still come.",
    button: "Stop reminders",
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u");
  if (!checkRemindersOffSig(userId, url.searchParams.get("sig"))) return continuePage(BAD);
  await prisma.user.updateMany({ where: { id: userId!, remindersOffAt: null }, data: { remindersOffAt: new Date() } });
  return continuePage({ title: "Reminders stopped", text: "You won't get reminder emails from MentorsMD anymore. Emails about your orders, calls and messages will still come." });
}
