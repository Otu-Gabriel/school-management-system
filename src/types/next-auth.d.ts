import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roleId?: string | null;
      roleName?: string | null;
      permissions: string[];
      name?: string | null;
      email?: string | null;
      image?: string | null;
      phone?: string | null;
    };
  }

  interface User {
    roleId?: string | null;
    roleName?: string | null;
    permissions: string[];
    phone?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roleId?: string | null;
    roleName?: string | null;
    permissions?: string[];
    phone?: string | null;
  }
}
