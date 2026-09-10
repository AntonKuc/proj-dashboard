import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & { role?: "ADMIN" | "VIEWER" };
  }
  interface User {
    role?: "ADMIN" | "VIEWER";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "VIEWER";
  }
}
