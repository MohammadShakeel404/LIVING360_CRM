import Link from "next/link";
import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { quotationTotals } from "@/lib/totals";
import { LEAD_STAGES, LEAD_STAGE_LABEL, humanize } from "@/lib/labels";
import { Card, EmptyState, MiniStat, PageHeader, formatCurrency } from "@/components/ui";

const PRESETS = [
  ["month", "This month"], ["30d", "Last 30 days"], ["quarter", "This quarter"], ["year", "This year"], ["all", "All time"],
] as const;

function range(preset: string) {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  switch (preset) {
    case "30d": return { from: new Date(to.getTime() - 30 * 86400000), to };
    case "quarter": return { from: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), to };
    case "year": return { from: new Date(now.getFullYear(), 0, 1), to };
    case "all": return { from: new Date(2000, 0, 1), to };
    default: return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  }
}

export default async function ReportsPage({ searchParams }: { searchParams: { p?: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "reports", "view")) return <EmptyState icon={Lock} title="No access" note="Your role doesn't have access to reports." />;

  const preset = PRESETS.some(([id]) => id === searchParams.p) ? searchParams.p! : "month";
  const { from, to } = range(preset);
  const inRange = { gte: from, lt: to };
  const financial = can(role, "reports", "financial");

  const [newLeads, leadsBySource, stageCounts, converted, lost, quotations, invoicesAgg, paymentsAgg, allOpenInvoices, sixMonthPayments, users] = await Promise.all([
    prisma.lead.count({ where: { createdAt: inRange } }),
    prisma.lead.groupBy({ by: ["source"], where: { createdAt: inRange }, _count: true }),
    prisma.lead.groupBy({ by: ["stage"], _count: true }),
    prisma.activityLog.count({ where: { action: "LEAD_CONVERTED", createdAt: inRange } }),
    prisma.lead.count({ where: { stage: "LOST", updatedAt: inRange } }),
    prisma.quotation.findMany({ where: { createdAt: inRange }, include: { items: { select: { quantity: true, rate: true, discountPct: true, gstPct: true } } } }),
    financial ? prisma.invoice.aggregate({ _sum: { totalAmount: true }, _count: true, where: { invoiceDate: inRange, status: { notIn: ["DRAFT", "CANCELLED"] } } }) : null,
    financial ? prisma.payment.aggregate({ _sum: { amount: true }, _count: true, where: { paidAt: inRange } }) : null,
    financial ? prisma.invoice.findMany({ where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } }, select: { totalAmount: true, payments: { select: { amount: true } } } }) : [],
    financial ? prisma.payment.findMany({ where: { paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1) } }, select: { amount: true, paidAt: true } }) : [],
    prisma.user.findMany({ where: { role: { in: ["SALES_EXECUTIVE", "SALES_MANAGER"] }, deletedAt: null }, select: { id: true, name: true } }),
  ]);

  const qTotals = quotations.map((q) => ({ ...q, total: quotationTotals(q.items, q.discountPct).grandTotal }));
  const sent = qTotals.filter((q) => q.status !== "DRAFT");
  const won = qTotals.filter((q) => q.status === "APPROVED");
  const decided = qTotals.filter((q) => q.status === "APPROVED" || q.status === "REJECTED");
  const outstanding = allOpenInvoices.reduce((s, i) => s + Number(i.totalAmount) - i.payments.reduce((a, p) => a + Number(p.amount), 0), 0);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - 5 + i, 1);
    const total = sixMonthPayments.filter((p) => p.paidAt.getFullYear() === d.getFullYear() && p.paidAt.getMonth() === d.getMonth()).reduce((s, p) => s + Number(p.amount), 0);
    return { label: d.toLocaleDateString("en-IN", { month: "short" }), total };
  });

  const people = await Promise.all(
    users.map(async (u) => {
      const [leads, conv] = await Promise.all([
        prisma.lead.count({ where: { assignedToId: u.id, createdAt: inRange } }),
        prisma.lead.count({ where: { assignedToId: u.id, stage: "CONVERTED", updatedAt: inRange } }),
      ]);
      const mine = qTotals.filter((q) => q.salespersonId === u.id);
      return { name: u.name, leads, conv, quoted: mine.filter((q) => q.status !== "DRAFT").reduce((s, q) => s + q.total, 0), won: mine.filter((q) => q.status === "APPROVED").reduce((s, q) => s + q.total, 0) };
    })
  );

  const sources = leadsBySource.map((s) => ({ label: humanize(s.source), value: s._count })).sort((a, b) => b.value - a.value);
  const funnel = LEAD_STAGES.map((s) => ({ label: LEAD_STAGE_LABEL[s], value: stageCounts.find((x) => x.stage === s)?._count ?? 0 }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Reports" subtitle={`${from.toLocaleDateString("en-IN")} – ${new Date(to.getTime() - 1).toLocaleDateString("en-IN")}`} />
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max gap-1 rounded-[10px] bg-line-soft p-1">
          {PRESETS.map(([id, label]) => (
            <Link key={id} href={`/reports?p=${id}`} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${preset === id ? "bg-white text-primary shadow-sm" : "text-ink-soft"}`}>{label}</Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="New leads" value={String(newLeads)} />
        <MiniStat label="Converted" value={String(converted)} sub={newLeads ? `${Math.round((converted / newLeads) * 100)}% of new leads` : undefined} tone="text-success" />
        <MiniStat label="Lost" value={String(lost)} tone={lost ? "text-danger" : undefined} />
        <MiniStat label="Quotation win rate" value={decided.length ? `${Math.round((won.length / decided.length) * 100)}%` : "—"} sub={`${won.length} won of ${decided.length} decided`} />
      </div>

      {financial && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat label="Quoted (sent)" value={formatCurrency(sent.reduce((s, q) => s + q.total, 0))} sub={`${sent.length} quotations`} />
          <MiniStat label="Invoiced" value={formatCurrency(Number(invoicesAgg?._sum.totalAmount ?? 0))} sub={`${invoicesAgg?._count ?? 0} invoices`} />
          <MiniStat label="Collected" value={formatCurrency(Number(paymentsAgg?._sum.amount ?? 0))} sub={`${paymentsAgg?._count ?? 0} payments`} tone="text-success" />
          <MiniStat label="Outstanding now" value={formatCurrency(outstanding)} tone={outstanding > 0 ? "text-warning" : undefined} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Leads by source" subtitle="New leads in this period">
          <Bars rows={sources} empty="No new leads in this period." />
        </Card>
        <Card title="Pipeline today" subtitle="All leads by current stage">
          <Bars rows={funnel} empty="No leads yet." />
        </Card>
        {financial && (
          <Card title="Collections — last 6 months">
            <div className="flex h-44 items-end gap-3">
              {months.map((m) => {
                const max = Math.max(...months.map((x) => x.total), 1);
                return (
                  <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[10.5px] font-semibold text-ink-soft">{m.total ? formatCurrency(m.total).replace("₹", "₹ ") : ""}</span>
                    <div className="w-full rounded-t-md bg-primary/85" style={{ height: `${Math.max((m.total / max) * 120, m.total ? 4 : 1)}px` }} title={formatCurrency(m.total)} />
                    <span className="text-[11.5px] text-ink-faint">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        <Card title="Sales team" subtitle="Leads assigned in this period">
          <div className="-m-4 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-appbg text-left text-[11.5px] font-semibold text-ink-soft">
                  <th className="px-4 py-2.5">Person</th><th className="px-3 py-2.5 text-right">Leads</th><th className="px-3 py-2.5 text-right">Converted</th>
                  {financial && <th className="px-4 py-2.5 text-right">Won value</th>}
                </tr>
              </thead>
              <tbody>
                {people.sort((a, b) => b.won - a.won || b.conv - a.conv).map((p) => (
                  <tr key={p.name} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-3 py-2.5 text-right">{p.leads}</td>
                    <td className="px-3 py-2.5 text-right">{p.conv}</td>
                    {financial && <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(p.won)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Bars({ rows, empty }: { rows: { label: string; value: number }[]; empty: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.some((r) => r.value)) return <div className="py-6 text-center text-[13px] text-ink-soft">{empty}</div>;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[130px_1fr_32px] items-center gap-2 text-[12.5px]">
          <span className="truncate text-ink-soft">{r.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <span className="text-right font-semibold text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
