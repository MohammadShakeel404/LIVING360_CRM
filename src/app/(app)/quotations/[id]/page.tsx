import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState, StatusChip, formatCurrency, formatDate } from "@/components/ui";
import { Lock, ArrowLeft, Send, Check, X as XIcon } from "lucide-react";
import Link from "next/link";
import { QuotationActions } from "./QuotationActions";

export default async function QuotationDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;

  if (!can(role, "quotations", "view")) {
    return <EmptyState icon={Lock} title="No access" note="You don't have permission to view quotations." />;
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true, phone: true, email: true } },
      lead: { select: { id: true, name: true, leadNumber: true } },
      salesperson: { select: { id: true, name: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quotation) {
    return <EmptyState icon={Lock} title="Not found" note="This quotation doesn't exist or has been removed." />;
  }

  const financial = can(role, "quotations", "financial");
  const canEdit = can(role, "quotations", "edit");
  const canApprove = role === "SUPER_ADMIN" || role === "ADMIN";

  // Compute totals
  const subtotal = quotation.items.reduce((sum, i) => {
    return sum + Number(i.quantity) * Number(i.rate);
  }, 0);
  const itemDiscounts = quotation.items.reduce((sum, i) => {
    const base = Number(i.quantity) * Number(i.rate);
    return sum + base * (Number(i.discountPct) / 100);
  }, 0);
  const afterDiscount = subtotal - itemDiscounts;
  const overallDiscount = afterDiscount * (Number(quotation.discountPct) / 100);
  const taxableAmount = afterDiscount - overallDiscount;
  const gstTotal = quotation.items.reduce((sum, i) => {
    const base = Number(i.quantity) * Number(i.rate);
    const disc = base * (Number(i.discountPct) / 100);
    return sum + (base - disc) * (Number(i.gstPct) / 100);
  }, 0);
  const grandTotal = taxableAmount + gstTotal;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/quotations" className="flex h-8 w-8 items-center justify-center rounded-lg bg-line-soft">
          <ArrowLeft size={16} className="text-ink-soft" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink">{quotation.quotationNumber}</h1>
            <StatusChip status={quotation.status} />
            {quotation.requiresApproval && (
              <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-bold text-warning">Needs Approval</span>
            )}
          </div>
          <div className="text-[13px] text-ink-soft">Version {quotation.version} · Created {formatDate(quotation.createdAt)}</div>
        </div>
      </div>

      {/* Actions */}
      {canEdit && (
        <QuotationActions
          quotationId={quotation.id}
          status={quotation.status}
          requiresApproval={quotation.requiresApproval}
          canApprove={canApprove}
        />
      )}

      {/* Client / Lead info */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl2 border border-line bg-white p-4">
          <div className="mb-2 text-[12.5px] font-semibold text-ink-soft">
            {quotation.client ? "Client" : "Lead"}
          </div>
          <div className="text-[14.5px] font-semibold text-ink">
            {quotation.client?.name ?? quotation.lead?.name ?? "—"}
          </div>
          {quotation.client?.phone && (
            <div className="text-xs text-ink-soft">{quotation.client.phone}</div>
          )}
          {quotation.client?.email && (
            <div className="text-xs text-ink-soft">{quotation.client.email}</div>
          )}
        </div>
        <div className="rounded-xl2 border border-line bg-white p-4">
          <div className="mb-2 text-[12.5px] font-semibold text-ink-soft">Salesperson</div>
          <div className="text-[14.5px] font-semibold text-ink">{quotation.salesperson.name}</div>
          <div className="text-xs text-ink-soft">
            Valid until: {formatDate(quotation.validUntil)}
          </div>
          <div className="text-xs text-ink-soft">
            Discount: {quotation.discountPct.toString()}%
          </div>
        </div>
      </div>

      {/* Line items */}
      {financial && (
        <div className="rounded-xl2 border border-line bg-white">
          <div className="border-b border-line px-4 py-3">
            <span className="text-[13.5px] font-semibold text-ink">Line Items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-soft bg-appbg text-left text-[11.5px] font-semibold text-ink-soft">
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5">Unit</th>
                  <th className="px-4 py-2.5 text-right">Rate</th>
                  <th className="px-4 py-2.5 text-right">Disc %</th>
                  <th className="px-4 py-2.5 text-right">GST %</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item, idx) => {
                  const base = Number(item.quantity) * Number(item.rate);
                  const disc = base * (Number(item.discountPct) / 100);
                  const amount = base - disc;
                  return (
                    <tr key={item.id} className="border-b border-line-soft">
                      <td className="px-4 py-2.5 text-ink-faint">{idx + 1}</td>
                      <td className="px-4 py-2.5">{item.category}</td>
                      <td className="px-4 py-2.5 font-medium text-ink">{item.name}</td>
                      <td className="px-4 py-2.5 text-right">{item.quantity.toString()}</td>
                      <td className="px-4 py-2.5">{item.unit}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(item.rate.toString())}</td>
                      <td className="px-4 py-2.5 text-right">{item.discountPct.toString()}%</td>
                      <td className="px-4 py-2.5 text-right">{item.gstPct.toString()}%</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-line px-4 py-3">
            <div className="ml-auto max-w-[280px] space-y-1 text-[13px]">
              <div className="flex justify-between text-ink-soft"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {itemDiscounts > 0 && (
                <div className="flex justify-between text-ink-soft"><span>Item discounts</span><span>−{formatCurrency(itemDiscounts)}</span></div>
              )}
              {overallDiscount > 0 && (
                <div className="flex justify-between text-ink-soft"><span>Overall discount ({quotation.discountPct.toString()}%)</span><span>−{formatCurrency(overallDiscount)}</span></div>
              )}
              <div className="flex justify-between text-ink-soft"><span>GST</span><span>+{formatCurrency(gstTotal)}</span></div>
              <div className="flex justify-between border-t border-line-soft pt-1 text-[15px] font-bold text-primary">
                <span>Grand Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!financial && (
        <div className="rounded-xl2 border border-line bg-white p-4 text-center text-[13.5px] text-ink-soft">
          Financial details are restricted for your role.
        </div>
      )}

      {/* Terms */}
      {quotation.termsAndConditions && (
        <div className="rounded-xl2 border border-line bg-white p-4">
          <div className="mb-2 text-[12.5px] font-semibold text-ink-soft">Terms & Conditions</div>
          <div className="whitespace-pre-wrap text-[13px] text-ink-soft">{quotation.termsAndConditions}</div>
        </div>
      )}
    </div>
  );
}
