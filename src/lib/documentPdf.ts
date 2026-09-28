import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/settings";
import { quotationTotals, invoiceTotals, lineNet, amountInWords } from "@/lib/totals";
import { renderPdf, type PdfDoc } from "@/lib/pdf";

const fmtDate = (d?: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const num = (v: { toString(): string }) => Number(v.toString());

export async function quotationPdf(id: string) {
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: {
      client: true,
      lead: true,
      salesperson: { select: { name: true, email: true, phone: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!q) return null;
  const co = await getCompanySettings();
  const t = quotationTotals(q.items, q.discountPct);
  const party = q.client ?? q.lead;
  const address = q.client?.address ?? q.lead?.address ?? q.lead?.projectLocation ?? null;

  const doc: PdfDoc = {
    heading: "QUOTATION",
    meta: [
      ["Quotation no.", q.quotationNumber + (q.version > 1 ? ` (v${q.version})` : "")],
      ["Date", fmtDate(q.createdAt)],
      ["Valid until", fmtDate(q.validUntil)],
    ],
    billTo: {
      label: "Prepared for",
      name: party?.name ?? "—",
      lines: [address, party?.phone, party?.email, q.client?.gstin && `GSTIN: ${q.client.gstin}`].filter(Boolean) as string[],
    },
    side: {
      label: "Prepared by",
      lines: [q.salesperson.name, q.salesperson.phone, q.salesperson.email, q.lead?.propertyType && `Property: ${q.lead.propertyType}`].filter(Boolean) as string[],
    },
    showDiscount: q.items.some((i) => num(i.discountPct) > 0),
    showHsn: false,
    rows: q.items.map((i) => ({
      group: i.category,
      title: i.name,
      sub: i.description ?? undefined,
      qty: i.quantity.toString(),
      unit: i.unit,
      rate: num(i.rate),
      discPct: num(i.discountPct),
      gstPct: num(i.gstPct),
      amount: lineNet(i),
    })),
    totals: [
      { label: "Subtotal", value: t.subtotal - t.itemDiscounts },
      ...(t.overallDiscount > 0 ? [{ label: `Discount (${q.discountPct.toString()}%)`, value: t.overallDiscount, negative: true }] : []),
      { label: "Taxable value", value: t.taxable },
      { label: "GST", value: t.gst },
      { label: "Grand total", value: t.grandTotal, strong: true },
    ],
    amountWords: amountInWords(t.grandTotal),
    terms: q.termsAndConditions ?? co.quotationTerms,
    showBank: true,
    watermark: q.status === "REJECTED" || q.status === "EXPIRED" ? q.status : null,
  };
  const buffer = await renderPdf(doc, co);
  return { buffer, filename: `${q.quotationNumber}.pdf`, title: `Quotation ${q.quotationNumber}`, party };
}

export async function invoicePdf(id: string) {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: { include: { lead: { select: { projectLocation: true, address: true } } } },
      quotation: { select: { quotationNumber: true } },
      project: { select: { projectNumber: true, siteLocation: true } },
      changeOrder: { select: { cosNumber: true } },
      items: { orderBy: { sortOrder: "asc" } },
      payments: { select: { amount: true } },
    },
  });
  if (!inv) return null;
  const co = await getCompanySettings();
  const t = inv.items.length ? invoiceTotals(inv.items) : { taxable: num(inv.totalAmount), gst: 0, grandTotal: num(inv.totalAmount) };
  const paid = inv.payments.reduce((sum, p) => sum + num(p.amount), 0);
  const address = inv.client.address ?? inv.client.lead?.address ?? inv.client.lead?.projectLocation ?? null;

  const doc: PdfDoc = {
    heading: "TAX INVOICE",
    meta: [
      ["Invoice no.", inv.invoiceNumber],
      ["Invoice date", fmtDate(inv.invoiceDate)],
      ["Due date", fmtDate(inv.dueDate)],
      ["Type", inv.type.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())],
    ],
    billTo: {
      label: "Bill to",
      name: inv.client.name,
      lines: [address, inv.client.phone, inv.client.email, inv.client.gstin && `GSTIN: ${inv.client.gstin}`].filter(Boolean) as string[],
    },
    side:
      inv.quotation || inv.project || inv.changeOrder
        ? {
            label: "Reference",
            lines: [
              inv.project ? `Project ${inv.project.projectNumber}` : "",
              inv.quotation ? `Against quotation ${inv.quotation.quotationNumber}` : "",
              inv.changeOrder ? `Against change of scope ${inv.changeOrder.cosNumber}` : "",
              inv.project?.siteLocation ? `Site: ${inv.project.siteLocation}` : "",
            ].filter(Boolean),
          }
        : undefined,
    showDiscount: false,
    showHsn: inv.items.some((i) => i.hsnSac),
    rows: inv.items.length
      ? inv.items.map((i) => ({
          title: i.description,
          hsn: i.hsnSac ?? undefined,
          qty: i.quantity.toString(),
          unit: i.unit,
          rate: num(i.rate),
          gstPct: num(i.gstPct),
          amount: num(i.quantity) * num(i.rate),
        }))
      : [{ title: `${inv.type.replaceAll("_", " ")} invoice`, qty: "1", unit: "Lot", rate: num(inv.totalAmount), gstPct: 0, amount: num(inv.totalAmount) }],
    totals: [
      { label: "Taxable value", value: t.taxable },
      { label: "GST", value: t.gst },
      { label: "Invoice total", value: t.grandTotal, strong: true },
      ...(paid > 0
        ? [
            { label: "Received", value: paid, negative: true },
            { label: "Balance due", value: Math.max(t.grandTotal - paid, 0) },
          ]
        : []),
    ],
    amountWords: amountInWords(t.grandTotal),
    notes: inv.notes,
    terms: co.invoiceTerms,
    showBank: true,
    watermark: inv.status === "PAID" ? "PAID" : inv.status === "CANCELLED" ? "CANCELLED" : inv.status === "DRAFT" ? "DRAFT" : null,
  };
  const buffer = await renderPdf(doc, co);
  return { buffer, filename: `${inv.invoiceNumber}.pdf`, title: `Invoice ${inv.invoiceNumber}`, party: inv.client };
}
