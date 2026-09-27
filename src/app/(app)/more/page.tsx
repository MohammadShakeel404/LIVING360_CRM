import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { MORE_MODULES } from "@/lib/moduleMeta";
import { Avatar } from "@/components/ui";
import { SignOutButton } from "./SignOutButton";

export default async function MorePage() {
  const session = await getServerSession(authOptions);
  const { role, name } = session!.user;
  const modules = MORE_MODULES.filter((m) => can(role, m.id, "view"));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl2 border border-line bg-white p-4">
        <Avatar name={name ?? "User"} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">{name}</div>
          <div className="text-[12.5px] text-ink-soft">{ROLE_LABEL[role]}</div>
        </div>
        <SignOutButton />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {modules.map((m) => (
          <Link key={m.href ?? m.id} href={m.href ?? `/${m.id}`} className="flex flex-col items-center gap-2 rounded-xl2 border border-line bg-white px-2 py-4 active:scale-[0.97]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><m.icon size={19} className="text-primary" /></div>
            <span className="text-center text-xs font-semibold text-ink">{m.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
