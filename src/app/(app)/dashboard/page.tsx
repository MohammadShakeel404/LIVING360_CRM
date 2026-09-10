import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { StatCard, SectionHeader, formatCurrency } from "@/components/ui";
import { Flame, Clock, FileText, IndianRupee, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  const scopeToSelf = role === "SALES_EXECUTIVE" ? { assignedToId: session!.user.id } : {};

  const [hotLeads, activeLeads, overdueLeads, todayFollowUps, pendingQuotations, paidThisMonth] = await Promise.all([
    prisma.lead.count({ where: { ...scopeToSelf, score: "HOT", stage: { not: "CONVERTED" } } }),
    prisma.lead.count({ where: { ...scopeToSelf, stage: { notIn: ["CONVERTED", "LOST"] } } }),
    prisma.lead.findMany({
      where: { ...scopeToSelf, nextFollowUpAt: { lt: new Date() }, stage: { notIn: ["CONVERTED", "LOST"] } },
      take: 5,
      orderBy: { nextFollowUpAt: "asc" },
    }),
    prisma.followUp.count({
      where: { status: "SCHEDULED", scheduledAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(23, 59, 59, 999)) } },
    }),
    prisma.quotation.count({ where: { status: "SENT" } }),
    can(role, "reports", "financial")
      ? prisma.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[13px] font-medium text-ink-soft">Welcome back, {session!.user.name}</div>
        <h1 className="mt-0.5 text-[22px] font-bold text-ink">Here's today's overview</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Hot leads" value={hotLeads} sub={`${activeLeads} active total`} subTone="text-danger" icon={Flame} href="/leads?score=HOT" />
        <StatCard label="Follow-ups today" value={todayFollowUps} sub={`${overdueLeads.length} overdue`} subTone={overdueLeads.length ? "text-warning" : "text-success"} icon={Clock} href="/followups" />
        <StatCard label="Pending quotations" value={pendingQuotations} sub="Awaiting client response" subTone="text-gold" icon={FileText} href="/quotations" />
        {paidThisMonth ? (
          <StatCard label="Monthly revenue" value={formatCurrency(paidThisMonth._sum.amount?.toString())} sub="Payments received" subTone="text-success" icon={IndianRupee} href="/reports" />
        ) : (
          <StatCard label="Monthly revenue" value="Restricted" sub="No financial access" icon={IndianRupee} />
        )}
      </div>

      <div>
        <SectionHeader title="Attention required" actionHref="/followups" />
        <div className="flex flex-col gap-2.5">
          {overdueLeads.length === 0 && (
            <div className="rounded-xl2 border border-line bg-white p-4 text-[13.5px] text-ink-soft">Nothing overdue — nice work.</div>
          )}
          {overdueLeads.map((l) => (
            <Link
              key={l.id}
              href={`/leads/${l.id}`}
              className="flex items-center gap-3 rounded-xl2 border border-danger/20 bg-white p-3"
            >
              <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] bg-danger-bg">
                <AlertTriangle size={16} className="text-danger" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink">{l.name}</div>
                <div className="text-xs font-medium text-danger">
                  Follow-up overdue since {l.nextFollowUpAt?.toLocaleDateString("en-IN")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
