import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Lock, Phone, Mail, FileText, Building2 } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { invoiceTotals } from "@/lib/totals";
import { effectiveInvoiceStatus } from "@/lib/invoices";
import { sharePath } from "@/lib/settings";
import { humanize } from "@/lib/labels";
import { EmptyState, StatusChip, PageHeader, Card, MiniStat, MethodChip, formatCurrency, formatDate } from "@/components/ui";
import { DocumentActions } from "@/components/DocumentActions";
import { InvoiceActions, DeletePaymentButton } from "./InvoiceActions";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "invoices", "view")) {
    return <EmptyState icon={Lock} title="No access" note="Your role doesn't have permission to view invoices." />;
  }

  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      client: { include: { lead: { select: { whatsapp: true } } } },
      quotation: { select: { id: true, quotationNumber: true } },
      project: { select: { id: true, projectNumber: true } },
      changeOrder: { select: { id: true, cosNumber: true, projectId: true } },
      items: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!inv) notFound();

  const financial = can(role, "invoices", "financial");
  const total = Number(inv.totalAmount);
  const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.max(total - paid, 0);
  const status = effectiveInvoiceStatus(inv.status, total, paid, inv.dueDate);
  const t = inv.items.length ? invoiceTotals(inv.items) : { taxable: total, gst: 0, grandTotal: total };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back="/invoices"
        title={inv.invoiceNumber}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusChip status={status} /> {humanize(inv.type)} invoice · {formatDate(inv.invoiceDate)}</span>}
      />

      {financial ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Invoice total" value={formatCurrency(total)} />
            <MiniStat label="Received" value={formatCurrency(paid)} tone="text-success" />
            <MiniStat label="Balance due" value={formatCurrency(balance)} tone={status === "OVERDUE" ? "text-danger" : balance ? "text-ink" : "text-success"} sub={inv.dueDate ? `Due ${formatDate(inv.dueDate)}` : undefined} />
          </div>

          <Card>
            <div className="flex flex-col gap-4">
              <DocumentActions
                pdfUrl={`/api/invoices/${inv.id}/pdf`}
                sharePath={sharePath("invoice", inv.id)}
                filename={`${inv.invoiceNumber}.pdf`}
                title={`Invoice ${inv.invoiceNumber}`}
                recipientName={inv.client.name}
                phone={inv.client.lead?.whatsapp ?? inv.client.phone}
                email={inv.client.email}
                shareDisabledReason={inv.status === "DRAFT" ? "Issue the invoice before sharing" : null}
              />
              <InvoiceActions
                id={inv.id}
                status={inv.status}
                balance={balance}
                dueDate={inv.dueDate?.toISOString().slice(0, 10) ?? ""}
                hasPayments={inv.payments.length > 0}
                canEdit={can(role, "invoices", "edit")}
                canDelete={can(role, "invoices", "delete")}
                canPay={can(role, "payments", "create")}
              />
            </div>
          </Card>
        </>
      ) : (
        <Card><div className="text-center text-[13.5px] text-ink-soft">Amounts are restricted for your role.</div></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Bill to</div>
          <Link href={`/clients/${inv.client.id}`} className="text-[15px] font-semibold text-ink hover:text-primary">{inv.client.name}</Link>
          <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-soft"><Phone size={12} /> {inv.client.phone}</div>
          {inv.client.email && <div className="flex items-center gap-1.5 text-[12.5px] text-ink-soft"><Mail size={12} /> {inv.client.email}</div>}
          {inv.client.gstin && <div className="text-[12.5px] text-ink-soft">GSTIN {inv.client.gstin}</div>}
        </Card>
        <Card>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Reference</div>
          {inv.quotation ? (
            <Link href={`/quotations/${inv.quotation.id}`} className="flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline"><FileText size={14} /> {inv.quotation.quotationNumber}</Link>
          ) : !inv.changeOrder ? <div className="text-[13.5px] text-ink-soft">No quotation linked</div> : null}
          {inv.changeOrder && <Link href={`/projects/${inv.changeOrder.projectId}/cos/${inv.changeOrder.id}`} className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline"><FileText size={14} /> {inv.changeOrder.cosNumber}</Link>}
          {inv.project && <Link href={`/projects/${inv.project.id}`} className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline"><Building2 size={14} /> {inv.project.projectNumber}</Link>}
        </Card>
      </div>

      {financial && (
        <Card title="Lines">
          <div className="-m-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-line bg-appbg text-left text-[11.5px] font-semibold text-ink-soft">
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-3 py-2.5">HSN/SAC</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Rate</th>
                  <th className="px-3 py-2.5 text-right">GST</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((i) => (
                  <tr key={i.id} className="border-b border-line-soft">
                    <td className="px-4 py-2.5 font-medium text-ink">{i.description}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{i.hsnSac ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{i.quantity.toString()} {i.unit}</td>
                    <td className="px-3 py-2.5 text-right">{formatCurrency(i.rate.toString())}</td>
                    <td className="px-3 py-2.5 text-right text-ink-soft">{Number(i.gstPct)}%</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(Number(i.quantity) * Number(i.rate))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 ml-auto max-w-[300px] space-y-1.5 text-[13.5px]">
            <div className="flex justify-between px-3 text-ink-soft"><span>Taxable value</span><span className="font-medium text-ink">{formatCurrency(t.taxable)}</span></div>
            <div className="flex justify-between px-3 text-ink-soft"><span>GST</span><span className="font-medium text-ink">{formatCurrency(t.gst)}</span></div>
            <div className="flex justify-between rounded-lg bg-primary px-3 py-2 text-[15px] font-bold text-white"><span>Total</span><span>{formatCurrency(t.grandTotal)}</span></div>
          </div>
        </Card>
      )}

      {financial && (
        <Card title="Payments" subtitle={inv.payments.length ? `${inv.payments.length} received` : undefined}>
          {inv.payments.length === 0 ? (
            <div className="py-3 text-center text-[13px] text-ink-soft">No payments recorded yet.</div>
          ) : (
            <div className="-m-4">
              {inv.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">{formatCurrency(p.amount.toString())} <MethodChip method={p.method} /></div>
                    <div className="truncate text-[12px] text-ink-faint">{formatDate(p.paidAt)}{p.referenceNumber ? ` · Ref ${p.referenceNumber}` : ""}{p.notes ? ` · ${p.notes}` : ""}</div>
                  </div>
                  {can(role, "payments", "delete") && <DeletePaymentButton id={p.id} />}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {inv.notes && <Card title="Notes"><div className="whitespace-pre-wrap text-[13px] text-ink-soft">{inv.notes}</div></Card>}
    </div>
  );
}
