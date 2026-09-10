import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { Lock } from "lucide-react";
import { QuotationsClient } from "./QuotationsClient";

export default async function QuotationsPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;

  if (!can(role, "quotations", "view")) {
    return <EmptyState icon={Lock} title="No access" note="Your role doesn't have permission to view quotations." />;
  }

  const scoped = role === "SALES_EXECUTIVE" ? { salespersonId: session!.user.id } : {};
  const financial = can(role, "quotations", "financial");

  const quotations = await prisma.quotation.findMany({
    where: scoped,
    include: {
      client: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
      salesperson: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const shaped = quotations.map((q) => ({
    id: q.id,
    quotationNumber: q.quotationNumber,
    version: q.version,
    status: q.status,
    requiresApproval: q.requiresApproval,
    discountPct: q.discountPct.toString(),
    clientName: q.client?.name ?? q.lead?.name ?? "—",
    clientId: q.clientId,
    leadId: q.leadId,
    salesperson: q.salesperson.name,
    itemCount: q.items.length,
    total: financial
      ? q.items
          .reduce((sum, i) => {
            const base = Number(i.quantity) * Number(i.rate);
            const disc = base * (Number(i.discountPct) / 100);
            const gst = (base - disc) * (Number(i.gstPct) / 100);
            return sum + (base - disc) + gst;
          }, 0)
          .toString()
      : null,
    validUntil: q.validUntil?.toISOString() ?? null,
    createdAt: q.createdAt.toISOString(),
  }));

  // Fetch clients and leads for the create form
  const [clients, leads] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.lead.findMany({
      where: { stage: { notIn: ["CONVERTED", "LOST"] } },
      select: { id: true, name: true, leadNumber: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <QuotationsClient
      initialQuotations={shaped}
      clients={clients}
      leads={leads.map((l) => ({ ...l }))}
      canExport={can(role, "quotations", "export")}
      canCreate={can(role, "quotations", "create")}
      financialAccess={financial}
    />
  );
}
