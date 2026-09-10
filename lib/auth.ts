import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";

// The adapter is what lets NextAuth automatically create/find User rows
// for Google sign-ins and link them to an Account row. Because the User
// model's `role` field defaults to BUYER (see schema.prisma), any account
// the adapter creates for a first-time Google sign-in is a buyer by
// default - there is no path from Google sign-in to a SELLER or ADMIN
// account. Those are only ever created explicitly, elsewhere in the code
// (the invite-gated seller route, and manually for admins).
// Rate limiting settings: after this many wrong-password attempts in a
// row, the account is locked for this long before another attempt is
// allowed - regardless of whether the next attempt would've been
// correct. This is what stops someone from brute-force guessing a
// password by trying thousands of combinations back to back.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        // No password on file means this account was created via Google
        // only - there's nothing to check a typed password against.
        if (!user || !user.passwordHash) return null;

        // Locked out: refuse regardless of whether the password given
        // this time would have been correct. Deliberately returns the
        // same generic null as a wrong password, rather than a distinct
        // "you're locked out" message - this avoids confirming to an
        // attacker that the account/email exists and is just rate
        // limited, versus not existing at all.
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!valid) {
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
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
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
        const existing = await prisma.user.findUnique({ where: { email: user.email! } });
        if (existing && existing.role !== "BUYER") {
          return false; // rejects the sign-in attempt
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        // Credentials login already returns `role` on the user object.
        // Google sign-in doesn't, so look it up the first time.
        token.role = (user as any).role ?? (await prisma.user.findUnique({ where: { id: user.id } }))?.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
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


