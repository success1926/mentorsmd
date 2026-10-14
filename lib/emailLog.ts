import { prisma } from "@/lib/prisma";

// Admin -> Email log: one row per send attempt from lib/email.ts. Only
// who, what kind, subject and the result; never the email body. Logging
// must never break (or block) the send itself.
export const EMAIL_LOG_KEEP_DAYS = 90;

export async function logEmail(row: { templateKey: string; toEmail: string; subject: string; status: "SENT" | "FAILED"; providerId?: string | null; error?: string | null }) {
  try {
    await prisma.emailLog.create({
      data: {
        templateKey: row.templateKey.slice(0, 80),
        toEmail: row.toEmail.slice(0, 320),
        subject: row.subject.slice(0, 300),
        status: row.status,
        providerId: row.providerId ?? null,
        error: row.error ? row.error.slice(0, 1000) : null,
      },
    });
  } catch (err) {
    console.error("Couldn't write to the email log:", err);
  }
}

// Run by the daily safety cron.
export async function cleanupOldEmailLogs(now = new Date()) {
  const cutoff = new Date(now.getTime() - EMAIL_LOG_KEEP_DAYS * 86400_000);
  const r = await prisma.emailLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return r.count;
}
