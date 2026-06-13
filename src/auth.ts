import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { verifyWalletSignature } from '@/lib/wallet';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  session: { strategy: 'jwt' },

  trustHost: true,

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: { scope: 'read:user user:email repo' },
      },
    }),

    Credentials({
      id: 'wallet',
      name: 'Wallet',
      credentials: {
        address: { label: 'Wallet Address', type: 'text' },
        message: { label: 'Message', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
      },
      async authorize(credentials) {
        const { address, message, signature } = credentials as {
          address: string;
          message: string;
          signature: string;
        };

        if (!address || !message || !signature) return null;

        const valid = await verifyWalletSignature({ address, message, signature });
        if (!valid) return null;

        const user = await prisma.user.upsert({
          where: { email: `${address.toLowerCase()}@wallet.zyva` },
          update: { name: `${address.slice(0, 6)}...${address.slice(-4)}` },
          create: {
            email: `${address.toLowerCase()}@wallet.zyva`,
            name: `${address.slice(0, 6)}...${address.slice(-4)}`,
          },
        });

        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: 'wallet',
              providerAccountId: address.toLowerCase(),
            },
          },
          update: {},
          create: {
            userId: user.id,
            type: 'credentials',
            provider: 'wallet',
            providerAccountId: address.toLowerCase(),
          },
        });

        return user;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  secret: process.env.NEXTAUTH_SECRET,
});
