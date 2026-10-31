import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";
import { SESSION_IDLE_SECONDS, sessionEndReason, sessionRole } from "./sessionRules";
import { RATE_LIMITS, clearRateLimit, rateLimit, rateLimitCount } from "./rateLimit";
import { clientIp, ipKey } from "./request";
import { verifyRecaptcha } from "./recaptcha";
import { isBot } from "./honeypot";
import { isReservedName } from "./reservedNames";
import { redeemMfaTicket, twoStepAtLogin } from "./mfa";
import { recordSignup, signupAttribution } from "./activity";

// The adapter is what lets NextAuth automatically create/find User rows
// for Google sign-ins and link them to an Account row. Because the User
// model's `role` field defaults to BUYER (see schema.prisma), any account
// the adapter creates for a first-time Google sign-in is a buyer by
// default - there is no path from Google sign-in to a SELLER or ADMIN
// account. Those are only ever created explicitly, elsewhere in the code
// (the invite-gated seller route, and manually for admins).
// Login protection, in three layers:
//  1. Per IP: at most RATE_LIMITS.loginPerIp attempts per 15 minutes from
//     one connection, whatever the account (lib/rateLimit.ts).
//  2. Per account + IP: 5 wrong passwords for one account from one
//     connection blocks only THAT connection for 15 minutes. A stranger
//     guessing at a known email can't lock the real owner out this way.
//  3. Per account: after this many wrong passwords in a row from anywhere
//     (a spread-out attack), the account itself is locked for 15 minutes.
//     Resetting the password unlocks it.
const MAX_FAILED_ATTEMPTS = 20;
const LOCKOUT_MINUTES = 15;
const ROLE_RECHECK_MS = 5 * 60 * 1000;

const adapter = PrismaAdapter(prisma);

// Google sign-in for an account that was made for someone without their
// own login: a parent's gift creates a passwordless student account
// (lib/gifts.ts). NextAuth normally refuses Google for an email that
// already has an account (OAuthAccountNotLinked). We link Google to it
// only when it's that kind of account (a student, no password, no Google
// or other sign-in linked yet) and Google says it has checked the email,
// so it's no weaker than "Forgot password" to the same inbox. Any other
// existing account keeps NextAuth's refusal.
async function linkGoogleToPasswordlessStudent(
  user: { email?: string | null },
  account: { provider: string; providerAccountId: string; type: string; [key: string]: unknown },
  profile: unknown
): Promise<void> {
  if (!user.email || (profile as any)?.email_verified !== true) return;
  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
    select: { id: true },
  });
  if (linked) return;
  const existing = await prisma.user.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" } },
    select: { id: true, role: true, passwordHash: true, removedByAdmin: true, _count: { select: { accounts: true } } },
  });
  if (!existing || existing.role !== "BUYER" || existing.passwordHash || existing.removedByAdmin || existing._count.accounts > 0) return;
  // The same row NextAuth would write; NextAuth then finds it and logs
  // them in to that account.
  await adapter.linkAccount!({ ...(account as any), userId: existing.id });
}

// The password check behind every email-and-password login: the website
// (the Credentials provider below) and the phone app (lib/appAuth.ts).
// The caller has already done its own bot check and the per-IP limit.
// Returns the account, or null for every kind of refusal (wrong password,
// no password, locked, removed or disabled), so the answer never reveals
// which accounts exist.
export async function checkPassword(email: string, password: string, ip: string) {
  // Case-insensitive, so "Jane@x.com" and "jane@x.com" are the same account.
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
  });
  // No password on file means this account was created via Google
  // only - there's nothing to check a typed password against.
  if (!user || !user.passwordHash) return null;

  // Accounts removed by an admin can't sign in. (A mentor who
  // removed their own profile still can - they may have orders to
  // finish and payouts to collect.)
  if (user.removedByAdmin) return null;
  // Disabled admins (Admin -> Team) can't sign in either.
  if (user.adminDisabledAt) return null;

  // Locked out: refuse regardless of whether the password given
  // this time would have been correct. Deliberately returns the
  // same generic null as a wrong password, rather than a distinct
  // "you're locked out" message - this avoids confirming to an
  // attacker that the account/email exists and is just rate
  // limited, versus not existing at all.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return null;
  }
  const pairKey = `${user.id}:${ip}`;
  if ((await rateLimitCount(RATE_LIMITS.loginFailPerAccountIp, pairKey)) >= RATE_LIMITS.loginFailPerAccountIp.max) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    await rateLimit(RATE_LIMITS.loginFailPerAccountIp, pairKey);
    const attempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : null,
      },
    });
    return null;
  }

  // Successful login - reset the counter so a legitimate person
  // who mistyped their password a couple times isn't penalized
  // once they get it right.
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastActiveAt: new Date() },
  });
  await clearRateLimit(RATE_LIMITS.loginFailPerAccountIp, pairKey);
  return user;
}

export const authOptions: NextAuthOptions = {
  adapter,
  // maxAge is the inactivity limit: the login cookie is renewed whenever
  // the person uses the site, so it only runs out after 7 idle days.
  // The 30-day hard limit and the admin 1-hour limit are in sessionRules.
  session: { strategy: "jwt", maxAge: SESSION_IDLE_SECONDS },
  // Sign-in problems (e.g. a refused Google login) come back to
  // /login?error=..., which explains them (app/login/page.tsx).
  pages: { signIn: "/login", error: "/login" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        recaptchaToken: { label: "reCAPTCHA", type: "text" },
        website: { label: "Leave empty", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        // Hidden trap field filled in: a bot. Same answer as a wrong password.
        if (isBot(credentials)) return null;

        const ip = ipKey(req);
        const perIp = await rateLimit(RATE_LIMITS.loginPerIp, ip);
        if (!perIp.ok) return null;
        if (!(await verifyRecaptcha(credentials.recaptchaToken, "login", clientIp(req)))) return null;

        const user = await checkPassword(credentials.email, credentials.password, ip);
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  events: {
    // A new account from Google sign-in: store where the person first came
    // from (#83), read from the first-visit cookie on this request.
    async createUser({ user }) {
      try {
        const { headers } = await import("next/headers");
        const cookie = headers().get("cookie");
        const attribution = signupAttribution(cookie);
        await prisma.user.update({ where: { id: user.id }, data: attribution });
        await recordSignup(user.id, cookie, attribution.signupSource);
      } catch (err) {
        console.error("Couldn't store the signup source for a Google account:", err);
      }
    },
    // Google sign-ins: Google has confirmed the email, and a reserved
    // name from the Google profile ("Admin", "Support"...) is replaced.
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user?.id) return;
      try {
        const current = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, emailVerified: true } });
        if (!current) return;
        const data: { emailVerified?: Date; lastActiveAt: Date; name?: string } = { lastActiveAt: new Date() };
        if (!current.emailVerified) data.emailVerified = new Date();
        if (isReservedName(current.name || "")) data.name = "Student";
        await prisma.user.update({ where: { id: user.id }, data });
      } catch (err) {
        console.error("Couldn't update a Google sign-in:", err);
      }
    },
  },
  callbacks: {
    // Extra safety check on top of the role-default behavior above: if
    // someone signs in with Google using an email that already belongs to
    // a SELLER or ADMIN account, refuse it outright rather than silently
    // linking. This stops anyone from using a Google account to slip past
    // the invite gate on an email they don't actually control the
    // password for, and keeps seller/admin access strictly to the
    // channels that were designed for it.
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const existing = await prisma.user.findFirst({ where: { email: { equals: user.email, mode: "insensitive" } } });
        if (existing && existing.role !== "BUYER") {
          return false; // rejects the sign-in attempt
        }
        if (existing?.removedByAdmin) return false;
        // A gift's passwordless student account: link Google to it.
        if (existing) await linkGoogleToPasswordlessStudent(user, account, profile);
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      // Admin pages call update() every few minutes while the admin is
      // active (components/SessionWatcher.tsx); that's what keeps an
      // admin login alive.
      if (!user && sessionEndReason(token)) {
        token.revoked = true;
        return token;
      }
      if (trigger === "update") {
        token.lastSeenMs = Date.now();
        // 2-step verification finished on /admin/verify or /two-step: the
        // page hands over a one-time ticket the server issued after
        // checking the code.
        if (token.sub && (token.role === "ADMIN" || token.needs2fa) && !token.mfa && (session as any)?.mfaTicket) {
          if (await redeemMfaTicket(token.sub, (session as any).mfaTicket)) {
            token.mfa = true;
            token.mfaAtMs = Date.now();
          }
        }
      }
      if (user) {
        // Credentials login already returns `role` on the user object.
        // Google sign-in doesn't, so look it up the first time.
        token.role = (user as any).role ?? (await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } }))?.role;
        token.roleCheckedAt = Date.now();
        token.issuedAtMs = Date.now();
        token.lastSeenMs = Date.now();
        // 2-step verification (lib/mfa.ts): admins and mentors on every
        // login, students who turned it on. A browser the person trusted
        // for 30 days skips it. Until it's done the session gets a pending
        // role (lib/sessionRules.ts) and middleware.ts sends them to enter
        // their code. Google sign-ins go through here too.
        // If the check itself fails, admins and mentors still need the code.
        const step = await twoStepAtLogin(user.id).catch(() => ({ needs: token.role === "ADMIN" || token.role === "SELLER", trusted: false }));
        token.needs2fa = step.needs;
        token.mfa = !step.needs || step.trusted;
      } else if (token.sub && (token.role === "ADMIN" || Date.now() - ((token.roleCheckedAt as number) || 0) > ROLE_RECHECK_MS)) {
        // Re-read the role every few minutes (on every request for
        // admins), so demoting, disabling or removing an account takes
        // effect right away instead of lasting until the token expires.
        const fresh = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, passwordChangedAt: true, removedByAdmin: true, adminDisabledAt: true, sessionsRevokedAt: true },
        });
        const dueForActivity = Date.now() - ((token.roleCheckedAt as number) || 0) > ROLE_RECHECK_MS;
        if (dueForActivity) {
          // "Last active", for the 14-days-without-login check.
          await prisma.user.updateMany({ where: { id: token.sub }, data: { lastActiveAt: new Date() } }).catch(() => {});
          token.roleCheckedAt = Date.now();
        }
        const issued = (token.issuedAtMs as number) || 0;
        // Password reset, admin disabled/removed, or "end all sessions"
        // after this login started: end this session.
        if (
          !fresh ||
          fresh.removedByAdmin ||
          fresh.adminDisabledAt ||
          (fresh.passwordChangedAt && fresh.passwordChangedAt.getTime() > issued) ||
          (fresh.sessionsRevokedAt && fresh.sessionsRevokedAt.getTime() > issued) ||
          (token.role === "ADMIN" && fresh.role !== "ADMIN")
        ) {
          token.revoked = true;
        }
        token.role = fresh?.role ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.revoked) {
        // Every route checks session.user, so removing it logs this
        // browser out of all protected pages and APIs.
        // An empty session reads as "logged out" both in the browser and
        // on the server.
        return {} as any;
      }
      if (session.user) {
        // Someone who hasn't finished 2-step verification yet gets a
        // pending role (ADMIN_2FA, SELLER_2FA, BUYER_2FA), so every check
        // for "ADMIN", "SELLER" or "BUYER" refuses them until they do.
        (session.user as any).role = sessionRole(token);
        // This was missing entirely - without it, every route that checks
        // "who is the logged-in user" (sending invites, creating gigs,
        // booking orders, messaging, everything) receives an empty user
        // ID and fails. token.sub is set automatically by NextAuth to the
        // signed-in user's real database ID.
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};


