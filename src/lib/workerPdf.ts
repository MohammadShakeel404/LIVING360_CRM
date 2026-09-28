import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/settings";
import { amountInWords } from "@/lib/totals";
import { renderPdf, inr, type PdfDoc } from "@/lib/pdf";
import { assignmentSummary, labourSummary } from "@/lib/workers";

const fmtDate = (d?: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const human = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ");
const workerLines = (w: { trade: string; workerNumber: string; phone: string; upiId: string | null; bankName: string | null; accountNumber: string | null; ifsc: string | null }) =>
  [
    `${w.trade} · ${w.workerNumber}`,
    w.phone,
    w.upiId && `UPI: ${w.upiId}`,
    w.accountNumber && `A/c ${w.accountNumber}${w.ifsc ? ` · ${w.ifsc}` : ""}${w.bankName ? ` · ${w.bankName}` : ""}`,
  ].filter(Boolean) as string[];

const byDate = <T extends { paidAt: Date; createdAt: Date }>(a: T, b: T) => a.paidAt.getTime() - b.paidAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime();

/** Receipt for one payment, with the running account for that work. */
export async function workerReceiptPdf(paymentId: string) {
  const p = await prisma.workerPayment.findUnique({
    where: { id: paymentId },
    include: {
      stage: { select: { label: true } },
      recordedBy: { select: { name: true } },
      assignment: {
        include: {
          worker: true,
          stages: { orderBy: { sortOrder: "asc" } },
          payments: { select: { id: true, amount: true, stageId: true, paidAt: true, createdAt: true } },
          project: { select: { projectNumber: true, siteLocation: true, client: { select: { name: true } } } },
        },
      },
    },
  });
  if (!p) return null;
  const co = await getCompanySettings();
  const a = p.assignment;
  const ordered = [...a.payments].sort(byDate);
  const upToThis = ordered.slice(0, ordered.findIndex((x) => x.id === p.id) + 1);
  const amount = Number(p.amount);
  const totalPaid = upToThis.reduce((s, x) => s + Number(x.amount), 0);
  const payable = Number(a.agreedAmount);

  const doc: PdfDoc = {
    heading: "PAYMENT RECEIPT",
    meta: [["Receipt no.", p.receiptNumber], ["Date", fmtDate(p.paidAt)], ["Mode", p.method === "UPI" ? "UPI" : human(p.method)], ...(p.referenceNumber ? ([["Reference", p.referenceNumber]] as [string, string][]) : [])],
    billTo: { label: "Paid to", name: a.worker.name, lines: workerLines(a.worker) },
    side: {
      label: "Project",
      lines: [`${a.project.projectNumber} · ${a.project.client.name}`, a.project.siteLocation ? `Site: ${a.project.siteLocation}` : "", `Work: ${a.scope}`].filter(Boolean),
    },
    showDiscount: false,
    showHsn: false,
    rows: [],
    totals: [{ label: "Amount paid", value: amount, strong: true }],
    amountWords: amountInWords(amount),
    notes: p.notes,
    sections: [
      {
        title: "Payment for",
        table: { cols: [{ label: "Description" }, { label: "Amount", w: 110, align: "right" }], rows: [[p.stage ? `Stage: ${p.stage.label}` : "Direct / advance payment", inr(amount)]] },
      },
      {
        title: "Account for this work (after this payment)",
        table: {
          cols: [{ label: "Item" }, { label: "Amount", w: 110, align: "right" }],
          rows: [
            ["Agreed payable", inr(payable)],
            ["Paid before this receipt", inr(totalPaid - amount)],
            ["This payment", inr(amount)],
            ["Total paid to date", inr(totalPaid)],
            ["Balance payable", inr(Math.max(payable - totalPaid, 0))],
          ],
        },
      },
    ],
    clientSign: { label: "Received by", name: a.worker.name },
    showBank: false,
    watermark: null,
  };
  return { buffer: await renderPdf(doc, co), filename: `${p.receiptNumber}.pdf`, title: `Payment receipt ${p.receiptNumber}` };
}

/** Everything a worker has been engaged for and paid, across projects. */
export async function workerStatementPdf(workerId: string) {
  const w = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      assignments: {
        orderBy: { createdAt: "asc" },
        include: {
          project: { select: { projectNumber: true, client: { select: { name: true } } } },
          payments: { include: { stage: { select: { label: true } } } },
        },
      },
    },
  });
  if (!w) return null;
  const co = await getCompanySettings();
  const rows = w.assignments.map((a) => ({ a, s: assignmentSummary(a) }));
  const payable = rows.reduce((s, r) => s + r.s.payable, 0);
  const paid = rows.reduce((s, r) => s + r.s.paid, 0);
  const payments = w.assignments.flatMap((a) => a.payments.map((p) => ({ ...p, project: a.project.projectNumber }))).sort(byDate);

  const doc: PdfDoc = {
    heading: "WORKER STATEMENT",
    meta: [["Worker", w.workerNumber], ["As on", fmtDate(new Date())], ["Projects", String(w.assignments.length)]],
    billTo: { label: "Worker", name: w.name, lines: workerLines(w) },
    showDiscount: false,
    showHsn: false,
    rows: [],
    totals: [
      { label: "Total payable", value: payable },
      { label: "Total paid", value: paid },
      { label: "Balance payable", value: Math.max(payable - paid, 0), strong: true },
    ],
    amountWords: "",
    sections: [
      {
        title: "Work by project",
        table: {
          cols: [{ label: "Project" }, { label: "Work" }, { label: "Payable", w: 78, align: "right" }, { label: "Paid", w: 78, align: "right" }, { label: "Balance", w: 78, align: "right" }],
          rows: [
            ...rows.map(({ a, s }) => [`${a.project.projectNumber} · ${a.project.client.name}`, a.scope, inr(s.payable), inr(s.paid), inr(s.balance)]),
            ["Total", "", inr(payable), inr(paid), inr(Math.max(payable - paid, 0))],
          ],
        },
      },
      ...(payments.length
        ? [{
            title: "Payments",
            table: {
              cols: [{ label: "Date", w: 70 }, { label: "Receipt", w: 82 }, { label: "Project / stage" }, { label: "Mode", w: 70 }, { label: "Amount", w: 80, align: "right" as const }],
              rows: payments.map((p) => [fmtDate(p.paidAt), p.receiptNumber, `${p.project} · ${p.stage?.label ?? "Direct / advance"}`, p.method === "UPI" ? "UPI" : human(p.method), inr(Number(p.amount))]),
            },
          }]
        : []),
    ],
    showBank: false,
    watermark: null,
  };
  return { buffer: await renderPdf(doc, co), filename: `${w.workerNumber}-statement.pdf`, title: `Statement ${w.name}` };
}

/** Labour cost of a project: per trade and per worker, payable vs paid. */
export async function projectLabourPdf(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { name: true } },
      workers: { include: { worker: { select: { name: true, trade: true, workerNumber: true } }, payments: { select: { amount: true, stageId: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) return null;
  const co = await getCompanySettings();
  const rows = project.workers.map((a) => ({ a, s: assignmentSummary(a) }));
  const sum = labourSummary(rows.map(({ a, s }) => ({ trade: a.worker.trade, payable: s.payable, paid: s.paid })));
  const value = project.value ? Number(project.value) : null;

  const doc: PdfDoc = {
    heading: "LABOUR COST STATEMENT",
    meta: [["Project", project.projectNumber], ["As on", fmtDate(new Date())], ["Workers", String(project.workers.length)]],
    billTo: { label: "Project", name: project.client.name, lines: [project.siteLocation ?? ""].filter(Boolean) },
    side: value ? { label: "Cost share", lines: [`Contract value ${inr(value)}`, `Labour ${inr(sum.payable)} (${((sum.payable / value) * 100).toFixed(1)}% of value)`] } : undefined,
    showDiscount: false,
    showHsn: false,
    rows: [],
    totals: [
      { label: "Total labour payable", value: sum.payable },
      { label: "Paid to workers", value: sum.paid },
      { label: "Still to pay", value: sum.balance, strong: true },
    ],
    amountWords: "",
    sections: [
      {
        title: "By trade",
        table: {
          cols: [{ label: "Trade" }, { label: "Workers", w: 56, align: "right" }, { label: "Payable", w: 84, align: "right" }, { label: "Paid", w: 84, align: "right" }, { label: "Balance", w: 84, align: "right" }],
          rows: [...sum.byTrade.map((t) => [t.trade, String(t.workers), inr(t.payable), inr(t.paid), inr(t.balance)]), ["Total", String(rows.length), inr(sum.payable), inr(sum.paid), inr(sum.balance)]],
        },
      },
      {
        title: "By worker",
        table: {
          cols: [{ label: "Worker" }, { label: "Work" }, { label: "Payable", w: 76, align: "right" }, { label: "Paid", w: 76, align: "right" }, { label: "Balance", w: 76, align: "right" }],
          rows: rows.map(({ a, s }) => [`${a.worker.name} (${a.worker.trade})`, a.scope, inr(s.payable), inr(s.paid), inr(s.balance)]),
        },
      },
    ],
    showBank: false,
    watermark: null,
  };
  return { buffer: await renderPdf(doc, co), filename: `${project.projectNumber}-labour.pdf`, title: `Labour cost ${project.projectNumber}` };
}
