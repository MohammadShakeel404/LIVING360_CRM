import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { Lock } from "lucide-react";
import { LeadsClient } from "./LeadsClient";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;

  if (!can(role, "leads", "view")) {
    return <EmptyState icon={Lock} title="No access" note="Your role doesn't have permission to view leads. Ask your admin to update your access." />;
  }

  const scoped = role === "SALES_EXECUTIVE" ? { assignedToId: session!.user.id } : {};
  const financial = can(role, "leads", "financial");

  const leads = await prisma.lead.findMany({
    where: scoped,
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const shaped = leads.map((l) => ({
    ...l,
    budgetMin: financial ? (l.budgetMin ? l.budgetMin.toString() : null) : null,
    budgetMax: financial ? (l.budgetMax ? l.budgetMax.toString() : null) : null,
    createdAt: l.createdAt.toISOString(),
    nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null,
  }));

  return (
    <LeadsClient
      initialLeads={shaped}
      canExport={can(role, "leads", "export")}
      canCreate={can(role, "leads", "create")}
      financialAccess={financial}
    />
  );
}
