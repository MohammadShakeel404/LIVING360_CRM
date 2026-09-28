import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { quotationTotals } from "@/lib/totals";
import { EmptyState } from "@/components/ui";
import { QuotationsClient } from "./QuotationsClient";

export default async function QuotationsPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;

  if (!can(role, "quotations", "view")) {
    return <EmptyState icon={Lock} title="No access" note="Your role doesn't have permission to view quotations." />;
  }

  const financial = can(role, "quotations", "financial");
  const quotations = await prisma.quotation.findMany({
    where: role === "SALES_EXECUTIVE" ? { salespersonId: session!.user.id } : {},
    include: {
      client: { select: { name: true } },
      lead: { select: { name: true } },
      salesperson: { select: { name: true } },
      items: { select: { quantity: true, rate: true, discountPct: true, gstPct: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const shaped = quotations.map((q) => ({
    id: q.id,
    quotationNumber: q.quotationNumber,
    version: q.version,
    status: q.status,
    requiresApproval: q.requiresApproval,
    clientName: q.client?.name ?? q.lead?.name ?? "—",
    salesperson: q.salesperson.name,
    itemCount: q.items.length,
    total: financial ? quotationTotals(q.items, q.discountPct).grandTotal : null,
    validUntil: q.validUntil?.toISOString() ?? null,
    createdAt: q.createdAt.toISOString(),
  }));

  return (
    <QuotationsClient
      initialQuotations={shaped}
      initialTab={searchParams.status ?? "ALL"}
      canExport={can(role, "quotations", "export")}
      canCreate={can(role, "quotations", "create")}
      financialAccess={financial}
    />
  );
}
