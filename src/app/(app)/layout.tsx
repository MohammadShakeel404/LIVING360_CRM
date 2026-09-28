import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, PERMISSIONS, ROLE_LABEL } from "@/lib/permissions";
import { AppShell, type ShellAlert } from "@/components/AppShell";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { role, id } = session.user;

  const visibleModules = Object.entries(PERMISSIONS[role] ?? {}).filter(([, p]) => p.view).map(([m]) => m);
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

  const [pendingApprovals, overdueInvoices, overdueFollowUps] = await Promise.all([
    role === "SUPER_ADMIN" || role === "ADMIN"
      ? prisma.quotation.count({ where: { requiresApproval: true, status: "DRAFT" } })
      : 0,
    can(role, "invoices", "view")
      ? prisma.invoice.count({ where: { dueDate: { lt: startOfToday }, status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } } })
      : 0,
    can(role, "followups", "view")
      ? prisma.followUp.count({
          where: { status: "SCHEDULED", scheduledAt: { lt: startOfToday }, ...(role === "SALES_EXECUTIVE" ? { lead: { assignedToId: id } } : {}) },
        })
      : 0,
  ]);

  const alerts: ShellAlert[] = [];
  if (pendingApprovals) alerts.push({ href: "/quotations?status=APPROVAL", text: `${pendingApprovals} quotation${pendingApprovals > 1 ? "s" : ""} waiting for discount approval`, tone: "warning" });
  if (overdueInvoices) alerts.push({ href: "/invoices?status=OVERDUE", text: `${overdueInvoices} invoice${overdueInvoices > 1 ? "s are" : " is"} past due`, tone: "danger" });
  if (overdueFollowUps) alerts.push({ href: "/followups", text: `${overdueFollowUps} overdue follow-up${overdueFollowUps > 1 ? "s" : ""}`, tone: "danger" });

  return (
    <AppShell
      userName={session.user.name ?? "User"}
      roleLabel={ROLE_LABEL[role]}
      visibleModules={visibleModules}
      canCreateLead={can(role, "leads", "create")}
      alerts={alerts}
    >
      {children}
    </AppShell>
  );
}
