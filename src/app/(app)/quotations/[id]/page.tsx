import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Lock, AlertTriangle, Phone, Mail, User, CalendarClock, History } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, canApproveDiscount } from "@/lib/permissions";
import { quotationTotals, lineNet } from "@/lib/totals";
import { sharePath } from "@/lib/settings";
import { EmptyState, StatusChip, PageHeader, Card, formatCurrency, formatDate } from "@/components/ui";
import { DocumentActions } from "@/components/DocumentActions";
import { QuotationActions } from "./QuotationActions";

export default async function QuotationDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const { role, id: userId } = session!.user;

  if (!can(role, "quotations", "view")) {
    return <EmptyState icon={Lock} title="No access" note="You don't have permission to view quotations." />;
  }

  const q = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true, phone: true, email: true } },
      lead: { select: { id: true, name: true, leadNumber: true, phone: true, email: true, whatsapp: true, client: { select: { id: true } } } },
      salesperson: { select: { id: true, name: true } },
      items: { orderBy: { sortOrder: "asc" } },
      invoices: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
    },
  });
  if (!q || (role === "SALES_EXECUTIVE" && q.salespersonId !== userId)) notFound();

  const [revision, previous, approver] = await Promise.all([
    prisma.quotation.findUnique({ where: { supersedesId: q.id }, select: { id: true, quotationNumber: true } }),
    q.supersedesId ? prisma.quotation.findUnique({ where: { id: q.supersedesId }, select: { id: true, quotationNumber: true } }) : null,
    q.approvedById ? prisma.user.findUnique({ where: { id: q.approvedById }, select: { name: true } }) : null,
  ]);

  const financial = can(role, "quotations", "financial");
  const t = quotationTotals(q.items, q.discountPct);
  const party = q.client ?? q.lead;
  const phone = q.lead?.whatsapp ?? party?.phone;
  const clientId = q.client?.id ?? q.lead?.client?.id ?? null;
  const expired = q.validUntil && q.validUntil < new Date() && ["DRAFT", "SENT", "VIEWED"].includes(q.status);

  // Group rows by room/category, keeping the order items were entered in.
  const groups: { name: string; items: typeof q.items }[] = [];
  for (const i of q.items) {
    const g = groups.find((x) => x.name === i.category) ?? groups[groups.push({ name: i.category, items: [] }) - 1];
    g.items.push(i);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back="/quotations"
        title={q.quotationNumber}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip status={q.status} label={q.status === "APPROVED" ? "Accepted" : undefined} />
            {q.requiresApproval && q.status === "DRAFT" && <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-bold text-warning">Needs approval</span>}
            <span>Version {q.version} · Created {formatDate(q.createdAt)}</span>
          </span>
        }
      />

      {q.requiresApproval && q.status === "DRAFT" && (
        <div className="flex gap-2.5 rounded-xl2 border border-warning/30 bg-warning-bg p-3.5 text-[13px] text-warning">
          <AlertTriangle size={17} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold">Discount above {q.salesperson.name.split(" ")[0]}&apos;s limit</div>
            <div className="text-warning/90">
              {canApproveDiscount(role) ? "Review the pricing below and approve it so the quotation can be sent." : "An Admin or Super Admin must approve it before it can be sent to the client."}
            </div>
          </div>
        </div>
      )}
      {expired && (
        <div className="rounded-xl2 border border-danger/20 bg-danger-bg p-3.5 text-[13px] font-medium text-danger">
          This quotation passed its validity date on {formatDate(q.validUntil)}.{" "}
          {q.status === "DRAFT" ? "Edit it to set a new validity date before sharing." : "Create a revision with updated validity before sharing again."}
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-4">
          {financial && (
            <DocumentActions
              pdfUrl={`/api/quotations/${q.id}/pdf`}
              sharePath={sharePath("quotation", q.id)}
              filename={`${q.quotationNumber}.pdf`}
              title={`Quotation ${q.quotationNumber}`}
              recipientName={party?.name}
              phone={phone}
              email={party?.email}
              shareDisabledReason={q.requiresApproval && q.status === "DRAFT" ? "Share after discount approval" : null}
            />
          )}
          {can(role, "quotations", "edit") && (
            <QuotationActions
              id={q.id}
              status={q.status}
              requiresApproval={q.requiresApproval}
              canApprove={canApproveDiscount(role)}
              canEditItems={financial}
              canDelete={can(role, "quotations", "delete")}
              canInvoice={can(role, "invoices", "create")}
              clientId={clientId}
              leadId={q.lead?.id ?? null}
              canConvert={can(role, "clients", "create") || can(role, "leads", "edit")}
              hasRevision={!!revision}
            />
          )}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">{q.client ? "Client" : "Lead"}</div>
          <Link href={q.client ? `/clients/${q.client.id}` : q.lead ? `/leads/${q.lead.id}` : "#"} className="text-[15px] font-semibold text-ink hover:text-primary">{party?.name ?? "—"}</Link>
          {party?.phone && <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-soft"><Phone size={12} /> {party.phone}</div>}
          {party?.email && <div className="flex items-center gap-1.5 text-[12.5px] text-ink-soft"><Mail size={12} /> {party.email}</div>}
        </Card>
        <Card>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Prepared by</div>
          <div className="flex items-center gap-1.5 text-[15px] font-semibold text-ink"><User size={14} className="text-ink-soft" /> {q.salesperson.name}</div>
          {approver && <div className="mt-1 text-[12.5px] text-success">Discount approved by {approver.name}</div>}
        </Card>
        <Card>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Validity</div>
          <div className={`flex items-center gap-1.5 text-[15px] font-semibold ${expired ? "text-danger" : "text-ink"}`}><CalendarClock size={14} /> {formatDate(q.validUntil)}</div>
          {(previous || revision) && (
            <div className="mt-1 flex flex-col gap-0.5 text-[12.5px]">
              {previous && <Link href={`/quotations/${previous.id}`} className="flex items-center gap-1 text-primary hover:underline"><History size={12} /> Revises {previous.quotationNumber}</Link>}
              {revision && <Link href={`/quotations/${revision.id}`} className="flex items-center gap-1 text-primary hover:underline"><History size={12} /> Revised as {revision.quotationNumber}</Link>}
            </div>
          )}
        </Card>
      </div>

      {financial ? (
        <Card title="Line items" subtitle={`${q.items.length} items across ${groups.length} ${groups.length === 1 ? "section" : "sections"}`}>
          <div className="-m-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-line bg-appbg text-left text-[11.5px] font-semibold text-ink-soft">
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Rate</th>
                  <th className="px-3 py-2.5 text-right">Disc</th>
                  <th className="px-3 py-2.5 text-right">GST</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows key={g.name} name={g.name} items={g.items} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 ml-auto max-w-[320px] space-y-1.5 text-[13.5px]">
            <TotalRow label="Subtotal" value={t.subtotal} />
            {t.itemDiscounts > 0 && <TotalRow label="Item discounts" value={-t.itemDiscounts} />}
            {t.overallDiscount > 0 && <TotalRow label={`Overall discount (${q.discountPct.toString()}%)`} value={-t.overallDiscount} />}
            <TotalRow label="Taxable value" value={t.taxable} />
            <TotalRow label="GST" value={t.gst} />
            <div className="flex justify-between rounded-lg bg-primary px-3 py-2 text-[15px] font-bold text-white">
              <span>Grand total</span>
              <span>{formatCurrency(t.grandTotal)}</span>
            </div>
          </div>
        </Card>
      ) : (
        <Card><div className="text-center text-[13.5px] text-ink-soft">Pricing is restricted for your role.</div></Card>
      )}

      {q.invoices.length > 0 && (
        <Card title="Invoices raised">
          <div className="-m-4">
            {q.invoices.map((inv) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg">
                <span className="font-semibold text-primary">{inv.invoiceNumber}</span>
                <span className="flex items-center gap-3">
                  {financial && <span className="text-[13px] font-semibold">{formatCurrency(inv.totalAmount.toString())}</span>}
                  <StatusChip status={inv.status} />
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {q.termsAndConditions && (
        <Card title="Terms & conditions">
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">{q.termsAndConditions}</div>
        </Card>
      )}
    </div>
  );
}

function GroupRows({ name, items }: { name: string; items: { id: string; name: string; description: string | null; quantity: any; unit: string; rate: any; discountPct: any; gstPct: any }[] }) {
  return (
    <>
      <tr className="bg-line-soft/60">
        <td colSpan={6} className="px-4 py-1.5 text-[11.5px] font-bold uppercase tracking-wide text-primary">{name}</td>
      </tr>
      {items.map((i) => (
        <tr key={i.id} className="border-b border-line-soft">
          <td className="px-4 py-2.5">
            <div className="font-medium text-ink">{i.name}</div>
            {i.description && <div className="text-[12px] text-ink-faint">{i.description}</div>}
          </td>
          <td className="px-3 py-2.5 text-right whitespace-nowrap">{i.quantity.toString()} {i.unit}</td>
          <td className="px-3 py-2.5 text-right">{formatCurrency(i.rate.toString())}</td>
          <td className="px-3 py-2.5 text-right text-ink-soft">{Number(i.discountPct) ? `${i.discountPct}%` : "—"}</td>
          <td className="px-3 py-2.5 text-right text-ink-soft">{Number(i.gstPct)}%</td>
          <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(lineNet(i))}</td>
        </tr>
      ))}
    </>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between px-3 text-ink-soft">
      <span>{label}</span>
      <span className="font-medium text-ink">{value < 0 ? "− " + formatCurrency(-value) : formatCurrency(value)}</span>
    </div>
  );
}
