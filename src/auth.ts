// src/auth.ts
import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Секретный ключ для JWT — обязателен!
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is not set in environment variables");
}

// Helper for consistent log format
function formatAuthLog(requestId: string, event: string, userId?: string, status?: string, message?: string): string {
  const parts = [
    `[${requestId}]`,
    `auth ${event}`,
    userId ? `user: ${userId}` : 'user: -',
    status || '-',
    message || ''
  ].filter(Boolean);
  return parts.join(' - ');
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 дней
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const requestId = req?.headers?.['x-request-id'] || 'no-request-id';
        
        if (!credentials?.email || !credentials?.password) {
          logger.warn(formatAuthLog(requestId, 'signin', undefined, '401', 'Missing credentials'));
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.hashedPassword) {
          logger.warn(formatAuthLog(requestId, 'signin', undefined, '401', 'User not found or no password'));
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        );

        if (!isValid) {
          logger.warn(formatAuthLog(requestId, 'signin', user.id, '401', 'Invalid password'));
          return null;
        }

        if (!user.email) {
          logger.warn(formatAuthLog(requestId, 'signin', user.id, '401', 'No email'));
          return null;
        }

        logger.info(formatAuthLog(requestId, 'signin', user.id, '200', 'Success'));
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string | null | undefined;
      }
      return session;
    },
  },

  events: {
    async signIn({ user, account, profile, isNewUser }) {
      const requestId = 'signin-event';
      logger.info(formatAuthLog(requestId, 'signin', user.id, 'event', `New user: ${isNewUser}`));
    },
    async signOut({ session, token }) {
      const requestId = 'signout-event';
      const userId = token?.id as string | undefined;
      logger.info(formatAuthLog(requestId, 'signout', userId, 'event', 'User signed out'));
    },
    async createUser({ user }) {
      const requestId = 'create-user-event';
      logger.info(formatAuthLog(requestId, 'createUser', user.id, 'event', 'User created via provider'));
    },
  },

  pages: {
    signIn: "/",
    error: "/auth/error",
  },

  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60,
      },
    },
  },

  secret: NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

export const getServerAuthSession = () => getServerSession(authOptions);