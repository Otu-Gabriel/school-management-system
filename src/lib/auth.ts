import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = credentials?.identifier?.trim();
        const password = credentials?.password;
        if (!identifier || !password) return null;

        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: identifier.toLowerCase() }, { phone: identifier }],
            isActive: true,
          },
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
            staff: true,
            guardian: true,
            student: true,
          },
        });

        if (!user) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        const permissions =
          user.role?.permissions.map((rp) => rp.permission.code) || [];

        // Users without a role (or without portal access) should not get a session.
        if (!user.roleId || permissions.length === 0) {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        const displayName =
          user.staff
            ? `${user.staff.firstName} ${user.staff.lastName}`
            : user.guardian?.fullName ||
              (user.student
                ? `${user.student.firstName} ${user.student.lastName}`
                : user.email || user.phone || "User");

        return {
          id: user.id,
          email: user.email,
          name: displayName,
          image: user.imageUrl,
          phone: user.phone,
          roleId: user.roleId,
          roleName: user.role?.name || null,
          permissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.permissions = user.permissions || [];
        token.phone = user.phone;
        token.name = user.name;
        token.picture = user.image;
        token.email = user.email;
      }

      if (trigger === "update" && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.email !== undefined) token.email = session.email;
        if (session.image !== undefined) token.picture = session.image;
        if (session.phone !== undefined) token.phone = session.phone;
      }

      // Always reload role permissions so edits (e.g. removing dashboard.view)
      // apply on the next request without forcing a full re-login.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: {
            roleId: true,
            role: {
              select: {
                name: true,
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        });
        if (dbUser) {
          token.roleId = dbUser.roleId;
          token.roleName = dbUser.role?.name || null;
          token.permissions =
            dbUser.role?.permissions.map((rp) => rp.permission.code) || [];
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.roleId = token.roleId as string | null | undefined;
        session.user.roleName = token.roleName as string | null | undefined;
        session.user.permissions = (token.permissions as string[]) || [];
        session.user.phone = token.phone as string | null | undefined;
        session.user.name =
          (token.name as string | undefined) || session.user.name;
        session.user.email =
          (token.email as string | null | undefined) || session.user.email;
        session.user.image =
          (token.picture as string | null | undefined) || session.user.image;
      }
      return session;
    },
  },
};
