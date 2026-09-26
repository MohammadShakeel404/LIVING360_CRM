import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/settings";
import { quotationTotals, lineNet, amountInWords } from "@/lib/totals";
import { renderPdf, inr, type PdfDoc } from "@/lib/pdf";
import { changeOrderTotals, parseSchedule, workOrderNumber, DEFAULT_AGREEMENT_TERMS, DEFAULT_WORK_ORDER_TERMS } from "@/lib/contracts";

const fmtDate = (d?: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const num = (v: { toString(): string }) => Number(v.toString());
const lines = (text: string | null | undefined) => (text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const oneLine = (text: string) => text.replace(/\s*\n\s*/g, ", ");

async function loadAgreement(id: string) {
  return prisma.agreement.findUnique({
    where: { id },
    include: {
      project: { include: { client: true, projectManager: { select: { name: true, phone: true } } } },
      quotation: { include: { items: { orderBy: { sortOrder: "asc" } } } },
    },
  });
}
type LoadedQuote = NonNullable<Awaited<ReturnType<typeof loadAgreement>>>["quotation"];

function scopeRows(q: LoadedQuote) {
  return q.items.map((i) => ({
    group: i.category, title: i.name, sub: i.description ?? undefined, qty: i.quantity.toString(), unit: i.unit,
    rate: num(i.rate), discPct: num(i.discountPct), gstPct: num(i.gstPct), amount: lineNet(i),
  }));
}

function quoteTotals(q: LoadedQuote) {
  const t = quotationTotals(q.items, q.discountPct);
  return [
    { label: "Subtotal", value: t.subtotal - t.itemDiscounts },
    ...(t.overallDiscount > 0 ? [{ label: `Discount (${q.discountPct.toString()}%)`, value: t.overallDiscount, negative: true }] : []),
    { label: "Taxable value", value: t.taxable },
    { label: "GST", value: t.gst },
    { label: "Contract value", value: t.grandTotal, strong: true },
  ];
}

function scheduleTable(schedule: { label: string; pct: number }[], total: number) {
  return {
    cols: [{ label: "#", w: 24 }, { label: "Milestone" }, { label: "Share", w: 48, align: "right" as const }, { label: "Amount", w: 96, align: "right" as const }],
    rows: [
      ...schedule.map((m, i) => [String(i + 1), m.label, `${m.pct}%`, inr((total * m.pct) / 100)]),
      ["Total", "", "100%", inr(total)],
    ],
  };
}

export async function agreementPdf(id: string, kind: "agreement" | "workorder") {
  const a = await loadAgreement(id);
  if (!a) return null;
  const co = await getCompanySettings();
  const client = a.project.client;
  const value = num(a.contractValue);
  const schedule = parseSchedule(a.paymentSchedule);
  const site = a.project.siteLocation ?? client.address ?? "the Client's site";
  const clientLines = [client.address, client.phone, client.email, client.gstin && `GSTIN: ${client.gstin}`].filter(Boolean) as string[];
  const approvedCos = await prisma.changeOrder.findMany({ where: { projectId: a.projectId, status: "APPROVED" }, include: { items: true } });
  const cosNet = approvedCos.reduce((s, c) => s + changeOrderTotals(c.items).net, 0);
  const watermark = a.status === "CANCELLED" ? "CANCELLED" : a.status === "DRAFT" ? "DRAFT" : null;
  const showDiscount = a.quotation.items.some((i) => num(i.discountPct) > 0);
  const words = amountInWords(quotationTotals(a.quotation.items, a.quotation.discountPct).grandTotal);

  if (kind === "agreement") {
    const doc: PdfDoc = {
      layout: "contract",
      heading: "AGREEMENT",
      meta: [["Agreement no.", a.agreementNumber], ["Date", fmtDate(a.agreementDate)], ["Project", a.project.projectNumber], ["Quotation", a.quotation.quotationNumber]],
      billTo: { label: "Client", name: client.name, lines: clientLines },
      side: { label: "Company", lines: [co.companyName, co.address, co.gstin && `GSTIN: ${co.gstin}`].filter(Boolean) as string[] },
      intro: [
        `This Agreement is made on ${fmtDate(a.agreementDate)} between ${co.companyName}${co.address ? `, ${oneLine(co.address)}` : ""} (the "Company") and ${client.name}${client.address ? `, ${oneLine(client.address)}` : ""} (the "Client").`,
        `The Client has engaged the Company for interior design and execution at ${oneLine(site)}, as per quotation ${a.quotation.quotationNumber}, on the terms below.`,
      ],
      sections: [
        { title: "Scope of work", paragraphs: [`As detailed in Annexure A (quotation ${a.quotation.quotationNumber}).`, ...lines(a.exclusions).map((l) => `Not included: ${l}`)] },
        {
          title: "Contract value",
          paragraphs: [
            `${inr(value)} (${amountInWords(value)}), inclusive of GST.`,
            ...(approvedCos.length ? [`Approved changes of scope to date: ${cosNet < 0 ? "− " : "+ "}${inr(Math.abs(cosNet))}. Revised contract value: ${inr(value + cosNet)}.`] : []),
          ],
        },
        { title: "Payment schedule", table: scheduleTable(schedule, value) },
        {
          title: "Timeline",
          paragraphs: [
            a.startDate ? `Start date: ${fmtDate(a.startDate)}.` : "Start date: on receipt of the advance.",
            a.completionDate ? `Target completion: ${fmtDate(a.completionDate)}.` : "Target completion: as agreed in the project plan.",
          ],
        },
        { title: "Terms & conditions", numbered: true, paragraphs: lines(a.terms ?? co.agreementTerms ?? DEFAULT_AGREEMENT_TERMS) },
      ],
      clientSign: { label: "Accepted by the Client", name: client.name },
      itemsTitle: "Annexure A — Scope of work",
      showDiscount,
      showHsn: false,
      rows: scopeRows(a.quotation),
      totals: quoteTotals(a.quotation),
      amountWords: words,
      showBank: false,
      watermark,
    };
    return { buffer: await renderPdf(doc, co), filename: `${a.agreementNumber}-Agreement.pdf`, title: `Agreement ${a.agreementNumber}` };
  }

  const wo = workOrderNumber(a.agreementNumber);
  const doc: PdfDoc = {
    heading: "WORK ORDER",
    meta: [["Work order no.", wo], ["Date", fmtDate(a.agreementDate)], ["Project", a.project.projectNumber], ["Quotation", a.quotation.quotationNumber]],
    billTo: { label: "Client", name: client.name, lines: clientLines },
    side: {
      label: "Project",
      lines: [
        `Site: ${oneLine(site)}`,
        a.project.projectManager ? `Project manager: ${a.project.projectManager.name}${a.project.projectManager.phone ? ` (${a.project.projectManager.phone})` : ""}` : "",
        a.startDate ? `Start: ${fmtDate(a.startDate)}` : "",
        a.completionDate ? `Completion: ${fmtDate(a.completionDate)}` : "",
      ].filter(Boolean),
    },
    showDiscount,
    showHsn: false,
    rows: scopeRows(a.quotation),
    totals: quoteTotals(a.quotation),
    amountWords: words,
    sections: [
      { title: "Payment schedule", table: scheduleTable(schedule, value) },
      ...(lines(a.exclusions).length ? [{ title: "Not included", paragraphs: lines(a.exclusions) }] : []),
      ...(lines(a.workOrderNotes).length ? [{ title: "Instructions", paragraphs: lines(a.workOrderNotes) }] : []),
    ],
    terms: co.workOrderTerms ?? DEFAULT_WORK_ORDER_TERMS,
    clientSign: { label: "Order confirmed by the Client", name: client.name },
    showBank: true,
    watermark,
  };
  return { buffer: await renderPdf(doc, co), filename: `${wo}-WorkOrder.pdf`, title: `Work order ${wo}` };
}

export async function changeOrderPdf(id: string) {
  const c = await prisma.changeOrder.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      project: { include: { client: true } },
      quotation: { select: { quotationNumber: true } },
    },
  });
  if (!c) return null;
  const co = await getCompanySettings();
  const client = c.project.client;
  const t = changeOrderTotals(c.items);
  const credit = t.net < 0;
  const doc: PdfDoc = {
    heading: "CHANGE OF SCOPE",
    meta: [
      ["COS no.", c.cosNumber],
      ["Date", fmtDate(c.createdAt)],
      ["Project", c.project.projectNumber],
      ...(c.quotation ? ([["Original quote", c.quotation.quotationNumber]] as [string, string][]) : []),
    ],
    billTo: { label: "Client", name: client.name, lines: [client.address, client.phone, client.email].filter(Boolean) as string[] },
    side: {
      label: "Change",
      lines: [
        c.title,
        ...(c.reason ? [c.reason] : []),
        c.timeImpactDays ? `Timeline impact: ${c.timeImpactDays > 0 ? "+" : ""}${c.timeImpactDays} days` : "No change to the timeline",
      ],
    },
    showDiscount: false,
    showHsn: false,
    rows: c.items.map((i) => ({
      group: i.deduction ? "Deductions (work removed)" : "Additions",
      title: i.name,
      sub: [i.category, i.description].filter(Boolean).join(" · "),
      qty: i.quantity.toString(), unit: i.unit, rate: num(i.rate), gstPct: num(i.gstPct),
      amount: (i.deduction ? -1 : 1) * num(i.quantity) * num(i.rate),
    })),
    totals: [
      { label: "Additions", value: t.addTaxable },
      ...(t.dedTaxable ? [{ label: "Deductions", value: t.dedTaxable, negative: true }] : []),
      { label: "Net taxable value", value: Math.abs(t.netTaxable), negative: t.netTaxable < 0 },
      { label: "GST", value: Math.abs(t.netGst), negative: t.netGst < 0 },
      { label: credit ? "Net credit to client" : "Net additional amount", value: Math.abs(t.net), strong: true },
    ],
    amountWords: amountInWords(Math.abs(t.net)),
    terms: "On approval, this Change of Scope forms part of the agreement. The contract value and timeline are revised by the amounts and days shown above.",
    clientSign: { label: "Approved by the Client", name: client.name },
    showBank: !credit,
    watermark: c.status === "REJECTED" ? "REJECTED" : c.status === "DRAFT" ? "DRAFT" : null,
  };
  return { buffer: await renderPdf(doc, co), filename: `${c.cosNumber}.pdf`, title: `Change of scope ${c.cosNumber}` };
}
