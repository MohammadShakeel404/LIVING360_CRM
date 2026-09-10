import { prisma } from "@/lib/prisma";

/**
 * Centralized outstanding-amount calculation.
 * Returns totalAmount − sum(payments) for the given invoice.
 */
export async function getOutstandingAmount(invoiceId: string): Promise<number> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { totalAmount: true },
  });
  if (!invoice) return 0;

  const paid = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { invoiceId },
  });

  const total = Number(invoice.totalAmount);
  const sumPaid = Number(paid._sum.amount ?? 0);
  return Math.max(total - sumPaid, 0);
}

/**
 * Batch version: returns a map of invoiceId → outstanding amount.
 */
export async function getOutstandingAmounts(invoiceIds: string[]): Promise<Record<string, number>> {
  if (invoiceIds.length === 0) return {};

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds } },
    select: { id: true, totalAmount: true },
  });

  const payments = await prisma.payment.groupBy({
    by: ["invoiceId"],
    _sum: { amount: true },
    where: { invoiceId: { in: invoiceIds } },
  });

  const paidMap = Object.fromEntries(
    payments.map((p) => [p.invoiceId, Number(p._sum.amount ?? 0)])
  );

  return Object.fromEntries(
    invoices.map((inv) => [
      inv.id,
      Math.max(Number(inv.totalAmount) - (paidMap[inv.id] ?? 0), 0),
    ])
  );
}
