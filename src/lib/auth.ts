import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { RoleName, EmployeeStatus } from "@prisma/client";

// ponytail: in-memory login throttle per email; move to Redis if running multiple instances.
const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const RECHECK_MS = 60 * 1000;

export const authOptions: AuthOptions = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();

        const f = failures.get(email);
        if (f && f.count >= MAX_FAILS && f.until > Date.now()) throw new Error("LOCKED");

        const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
        const valid = user && user.status === EmployeeStatus.ACTIVE && (await bcrypt.compare(credentials.password, user.passwordHash));
        if (!valid) {
          const prev = f && f.until > Date.now() ? f.count : 0;
          failures.set(email, { count: prev + 1, until: Date.now() + LOCK_MS });
          return null;
        }
        failures.delete(email);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role as RoleName;
        token.checkedAt = Date.now();
        return token;
      }
      // Pick up role changes / deactivation without waiting for the session to expire.
      // Throwing here makes NextAuth drop the session, so deactivated users are signed out.
      if (!token.checkedAt || Date.now() - token.checkedAt > RECHECK_MS) {
        const fresh = await prisma.user.findUnique({ where: { id: token.id }, select: { role: true, status: true, name: true } });
        if (!fresh || fresh.status !== EmployeeStatus.ACTIVE) throw new Error("Account is inactive");
        Object.assign(token, { role: fresh.role, name: fresh.name, checkedAt: Date.now() });
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.name = token.name;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
