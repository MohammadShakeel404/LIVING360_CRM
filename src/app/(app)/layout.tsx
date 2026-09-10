import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { initialsOf } from "@/components/ui";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <AppShell userName={session.user.name ?? "User"} userInitials={initialsOf(session.user.name ?? "U")}>
      {children}
    </AppShell>
  );
}
