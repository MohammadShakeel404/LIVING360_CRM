"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-1.5 rounded-[10px] border border-danger/30 px-3 py-2 text-[13px] font-semibold text-danger">
      <LogOut size={15} /> Sign out
    </button>
  );
}
