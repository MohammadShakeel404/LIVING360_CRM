import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { effectiveInvoiceStatus } from "@/lib/invoices";
import { EmptyState } from "@/components/ui";
import { InvoicesClient } from "./InvoicesClient";

export default async function InvoicesPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "invoices", "view")) {
    return <EmptyState icon={Lock} title="No access" note="Your role doesn't have permission to view invoices." />;
  }
  const financial = can(role, "invoices", "financial");

  const invoices = await prisma.invoice.findMany({
    include: { client: { select: { name: true } }, quotation: { select: { quotationNumber: true } }, payments: { select: { amount: true } } },
    orderBy: { invoiceDate: "desc" },
    take: 300,
  });

  const rows = invoices.map((inv) => {
    const total = Number(inv.totalAmount);
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.client.name,
      quotationNumber: inv.quotation?.quotationNumber ?? null,
      type: inv.type,
      status: effectiveInvoiceStatus(inv.status, total, paid, inv.dueDate),
      invoiceDate: inv.invoiceDate.toISOString(),
      dueDate: inv.dueDate?.toISOString() ?? null,
      total: financial ? total : null,
      balance: financial ? Math.max(total - paid, 0) : null,
    };
  });

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const collected = financial ? await prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }) : null;

  return (
    <InvoicesClient
      rows={rows}
      initialTab={searchParams.status ?? "ALL"}
      collectedThisMonth={collected ? Number(collected._sum.amount ?? 0) : null}
      canCreate={can(role, "invoices", "create") && financial}
      canExport={can(role, "invoices", "export")}
      financial={financial}
    />
  );
}
