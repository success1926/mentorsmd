import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";
import { SESSION_IDLE_SECONDS, sessionEndReason } from "./sessionRules";
import { RATE_LIMITS, clearRateLimit, rateLimit, rateLimitCount } from "./rateLimit";
import { clientIp, ipKey } from "./request";
import { verifyRecaptcha } from "./recaptcha";
import { isBot } from "./honeypot";
import { isReservedName } from "./reservedNames";
import { redeemMfaTicket } from "./mfa";

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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // maxAge is the inactivity limit: the login cookie is renewed whenever
  // the person uses the site, so it only runs out after 7 idle days.
  // The 30-day hard limit and the admin 1-hour limit are in sessionRules.
  session: { strategy: "jwt", maxAge: SESSION_IDLE_SECONDS },
  pages: { signIn: "/login" },
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

        // Case-insensitive, so "Jane@x.com" and "jane@x.com" are the same account.
        const user = await prisma.user.findFirst({
          where: { email: { equals: credentials.email.trim(), mode: "insensitive" } },
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

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);

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

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  events: {
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
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const existing = await prisma.user.findFirst({ where: { email: { equals: user.email, mode: "insensitive" } } });
        if (existing && existing.role !== "BUYER") {
          return false; // rejects the sign-in attempt
        }
        if (existing?.removedByAdmin) return false;
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
        // 2-step verification finished on /admin/verify: the page hands
        // over a one-time ticket the server issued after checking the code.
        if (token.sub && token.role === "ADMIN" && !token.mfa && (session as any)?.mfaTicket) {
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
        // Admins must pass 2-step verification on every login.
        token.mfa = false;
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
        // An admin who hasn't finished 2-step verification yet gets a
        // different role, so every admin-only check (role === "ADMIN")
        // refuses them until they do (/admin/verify).
        (session.user as any).role = token.role === "ADMIN" && !token.mfa ? "ADMIN_2FA" : token.role;
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


