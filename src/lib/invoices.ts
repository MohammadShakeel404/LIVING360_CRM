import { z } from "zod";
import { InvoiceType, type InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { quotationTotals, invoiceTotals } from "@/lib/totals";
import { changeOrderTotals } from "@/lib/contracts";

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Every line needs a description").max(300),
  hsnSac: z.string().trim().max(12).optional().nullable(),
  quantity: z.number().positive("Quantity must be more than 0"),
  unit: z.string().trim().min(1).max(20),
  rate: z.number().min(0),
  gstPct: z.number().min(0).max(28),
});

export const invoiceInputSchema = z.object({
  clientId: z.string().min(1, "Choose a client"),
  quotationId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  changeOrderId: z.string().optional().nullable(),
  type: z.nativeEnum(InvoiceType),
  invoiceDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line"),
});
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

export const invoiceItemRows = (items: InvoiceInput["items"]) =>
  items.map((i, idx) => ({ ...i, hsnSac: i.hsnSac || null, sortOrder: idx }));

/**
 * Status shown to users. PAID / PARTIALLY_PAID come from payments; OVERDUE is derived from the
 * due date at read time so it never goes stale.
 */
export function effectiveInvoiceStatus(stored: InvoiceStatus, total: number, paid: number, dueDate: Date | null): InvoiceStatus {
  if (stored === "CANCELLED" || stored === "DRAFT") return stored;
  if (paid >= total - 0.5) return "PAID";
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
  if (dueDate && dueDate < startOfToday) return "OVERDUE";
  return paid > 0 ? "PARTIALLY_PAID" : "SENT";
}

/** Re-derives and stores the payment-driven status after payments change. */
export async function refreshInvoiceStatus(invoiceId: string) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: { select: { amount: true } } } });
  if (!inv) return null;
  const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
  let status: InvoiceStatus = inv.status;
  if (inv.status !== "CANCELLED") {
    status = paid >= Number(inv.totalAmount) - 0.5 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : inv.status === "DRAFT" ? "DRAFT" : "SENT";
  }
  if (status !== inv.status) await prisma.invoice.update({ where: { id: inv.id }, data: { status } });
  return { status, paid, total: Number(inv.totalAmount) };
}

/** How much of a quotation's grand total is already invoiced (excluding cancelled invoices). */
export async function quotationBilling(quotationId: string, excludeInvoiceId?: string) {
  const q = await prisma.quotation.findUnique({ where: { id: quotationId }, include: { items: true } });
  if (!q) return null;
  const agg = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    where: { quotationId, status: { not: "CANCELLED" }, ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}) },
  });
  const total = quotationTotals(q.items, q.discountPct).grandTotal;
  const invoiced = Number(agg._sum.totalAmount ?? 0);
  return { quotation: q, total, invoiced, remaining: Math.max(total - invoiced, 0) };
}

/** Validates party links and the quotation ceiling; returns an error message or the computed total. */
export async function checkInvoiceInput(data: InvoiceInput, excludeInvoiceId?: string): Promise<{ error: string } | { total: number }> {
  const client = await prisma.client.findUnique({ where: { id: data.clientId }, select: { id: true } });
  if (!client) return { error: "Client not found." };
  const total = invoiceTotals(data.items).grandTotal;
  if (total <= 0) return { error: "Invoice total must be more than zero." };

  if (data.quotationId) {
    const billing = await quotationBilling(data.quotationId, excludeInvoiceId);
    if (!billing) return { error: "Quotation not found." };
    if (billing.quotation.clientId && billing.quotation.clientId !== data.clientId) return { error: "That quotation belongs to a different client." };
    if (total > billing.remaining + 5) { // small tolerance for per-line rounding
      const f = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
      return { error: `This would bill ${f(total)}, but only ${f(billing.remaining)} of ${billing.quotation.quotationNumber} (${f(billing.total)}) is left to invoice.` };
    }
  }
  if (data.changeOrderId) {
    if (data.quotationId) return { error: "Bill a change of scope on its own invoice, without a quotation." };
    const c = await prisma.changeOrder.findUnique({ where: { id: data.changeOrderId }, include: { items: true, project: { select: { clientId: true } } } });
    if (!c || c.project.clientId !== data.clientId) return { error: "That change of scope belongs to a different client." };
    if (c.status !== "APPROVED") return { error: "Only an approved change of scope can be invoiced." };
    const agg = await prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { changeOrderId: c.id, status: { not: "CANCELLED" }, ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}) },
    });
    const remaining = changeOrderTotals(c.items).net - Number(agg._sum.totalAmount ?? 0);
    if (total > remaining + 5) {
      const f = (n: number) => "₹" + Math.round(Math.max(n, 0)).toLocaleString("en-IN");
      return { error: `Only ${f(remaining)} of ${c.cosNumber} is left to invoice.` };
    }
  }
  if (data.projectId) {
    const p = await prisma.project.findUnique({ where: { id: data.projectId }, select: { clientId: true } });
    if (!p || p.clientId !== data.clientId) return { error: "That project belongs to a different client." };
  }
  return { total };
}
