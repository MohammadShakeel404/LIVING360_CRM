import { prisma } from "@/lib/prisma";
import { quotationTotals, lineNet } from "@/lib/totals";
import { changeOrderTotals } from "@/lib/contracts";
import type { ClientOption } from "./InvoiceEditor";

/** Clients with their billable quotations (net line rates pre-computed) and projects, for the invoice editor. */
export async function loadInvoiceClients(excludeInvoiceId?: string): Promise<ClientOption[]> {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, clientNumber: true,
      projects: {
        select: {
          id: true, projectNumber: true,
          changeOrders: {
            where: { status: "APPROVED" },
            include: { items: true, invoices: { where: { status: { not: "CANCELLED" }, ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}) }, select: { totalAmount: true } } },
          },
        },
      },
      quotations: {
        where: { status: { in: ["APPROVED", "SENT", "VIEWED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          invoices: { where: { status: { not: "CANCELLED" }, ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}) }, select: { totalAmount: true } },
        },
      },
    },
  });

  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    clientNumber: c.clientNumber,
    projects: c.projects.map((p) => ({ id: p.id, projectNumber: p.projectNumber })),
    changeOrders: c.projects.flatMap((p) =>
      p.changeOrders.map((co) => {
        const byGst = new Map<number, number>();
        for (const i of co.items) byGst.set(Number(i.gstPct), (byGst.get(Number(i.gstPct)) ?? 0) + (i.deduction ? -1 : 1) * Number(i.quantity) * Number(i.rate));
        return {
          id: co.id, cosNumber: co.cosNumber, title: co.title, projectId: p.id,
          net: changeOrderTotals(co.items).net,
          invoiced: co.invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
          byGst: [...byGst.entries()].map(([gstPct, taxable]) => ({ gstPct, taxable })),
        };
      })
    ),
    quotations: c.quotations.map((q) => {
      const overall = 1 - Number(q.discountPct) / 100;
      return {
        id: q.id,
        quotationNumber: q.quotationNumber,
        status: q.status,
        total: quotationTotals(q.items, q.discountPct).grandTotal,
        invoiced: q.invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
        lines: q.items.map((i) => ({
          title: `${i.category}: ${i.name}${i.description ? ` — ${i.description}` : ""}`,
          quantity: Number(i.quantity),
          unit: i.unit,
          netRate: (lineNet(i) * overall) / Number(i.quantity),
          gstPct: Number(i.gstPct),
        })),
      };
    }),
  }));
}
