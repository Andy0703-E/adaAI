import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "../db/prisma";
import { verifyPassword } from "./password";
import { loginSchema } from "../validation/auth";
import { rateLimit } from "../rate-limit";
import { hashIdentifier } from "../rate-limit/keys";
import { logAuditEvent } from "../logger/audit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const requestId = (req?.headers as any)?.["x-request-id"] || crypto.randomUUID();
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          logAuditEvent({
            event: "AUTH_LOGIN_FAILED",
            requestId,
            metadata: { reason: "VALIDATION_FAILED" },
          });
          return null;
        }

        const { email, password } = parsed.data;
        const identifierHash = hashIdentifier(email);

        // Rate limit login attempts per target email identifier to prevent credential stuffing
        const rl = await rateLimit({
          scope: "login",
          identifier: email,
        });
        if (!rl.allowed) {
          logAuditEvent({
            event: "RATE_LIMIT_BLOCKED",
            requestId,
            identifierHash,
            metadata: { scope: "login", retryAfter: rl.retryAfter },
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          logAuditEvent({
            event: "AUTH_LOGIN_FAILED",
            requestId,
            identifierHash,
            metadata: { reason: "USER_NOT_FOUND" },
          });
          return null;
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          logAuditEvent({
            event: "AUTH_LOGIN_FAILED",
            requestId,
            userId: user.id,
            identifierHash,
            metadata: { reason: "INVALID_PASSWORD" },
          });
          return null;
        }

        logAuditEvent({
          event: "AUTH_LOGIN_SUCCESS",
          requestId,
          userId: user.id,
          identifierHash,
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Host-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET || "development-auth-secret-fallback-min-32-chars",
});
