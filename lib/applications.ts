import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Simple spam limits for the public application form, using the
// applications already in the database (no extra service needed).
// reCAPTCHA is planned for later; this keeps bots and repeat
// submissions in check until then.
export const MAX_PER_IP_PER_DAY = 3;
export const MAX_PER_EMAIL_PER_DAY = 2;

// The sender's IP, as Vercel reports it. Only a salted hash is ever stored.
export function ipHashFor(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
  const ip = fwd.split(",")[0].trim();
  if (!ip) return null;
  return crypto
    .createHash("sha256")
    .update(`${process.env.NEXTAUTH_SECRET || "mentorsmd"}:${ip}`)
    .digest("hex");
}

// Returns a message for the person if they're over a limit, else null.
export async function applicationLimitError(ipHash: string | null, email?: string): Promise<string | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (ipHash) {
    const fromIp = await prisma.mentorApplication.count({ where: { ipHash, createdAt: { gte: since } } });
    if (fromIp >= MAX_PER_IP_PER_DAY) {
      return "We've received several applications from this connection today. Please try again tomorrow, or email us instead.";
    }
  }
  if (email) {
    const fromEmail = await prisma.mentorApplication.count({ where: { email, createdAt: { gte: since } } });
    if (fromEmail >= MAX_PER_EMAIL_PER_DAY) {
      return "We already have your application. Our team will be in touch; there's no need to apply again.";
    }
  }
  return null;
}
