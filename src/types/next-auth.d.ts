import { RoleName } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: RoleName;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: RoleName;
    /** Epoch ms of the last DB re-check of role/status. */
    checkedAt?: number;
  }
}
