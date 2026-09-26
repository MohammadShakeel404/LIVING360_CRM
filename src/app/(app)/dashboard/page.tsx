import Link from "next/link";
import { getServerSession } from "next-auth";
import { Flame, Clock, FileText, IndianRupee, AlertTriangle, Building2, ListChecks, Receipt, Plus, ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { MyTasks } from "./MyTasks";
import { prisma } from "@/lib/prisma";
import { can, canApproveDiscount } from "@/lib/permissions";
import { StatCard, SectionHeader, formatCurrency, formatDate, formatDateTime, btn } from "@/components/ui";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const { role, id, name } = session!.user;
  const own = role === "SALES_EXECUTIVE";
  const leadScope = own ? { assignedToId: id } : {};
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
  const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const seeLeads = can(role, "leads", "view");
  const seeFollowups = can(role, "followups", "view");
  const seeQuotes = can(role, "quotations", "view");
  const seeMoney = can(role, "reports", "financial") || can(role, "invoices", "financial");
  const seeProjects = can(role, "projects", "view");
  const seeTasks = can(role, "tasks", "view");

  const [hotLeads, activeLeads, overdueLeads, todayFollowUps, sentQuotes, approvals, paidThisMonth, openInvoices, activeProjects, myTasks] = await Promise.all([
    seeLeads ? prisma.lead.count({ where: { ...leadScope, score: "HOT", stage: { notIn: ["CONVERTED", "LOST"] } } }) : 0,
    seeLeads ? prisma.lead.count({ where: { ...leadScope, stage: { notIn: ["CONVERTED", "LOST"] } } }) : 0,
    seeLeads ? prisma.lead.findMany({ where: { ...leadScope, nextFollowUpAt: { lt: new Date() }, stage: { notIn: ["CONVERTED", "LOST"] } }, take: 5, orderBy: { nextFollowUpAt: "asc" } }) : [],
    seeFollowups ? prisma.followUp.findMany({
      where: { status: "SCHEDULED", scheduledAt: { gte: startOfToday, lte: endOfToday }, ...(own ? { lead: { assignedToId: id } } : {}) },
      include: { lead: { select: { id: true, name: true } } }, orderBy: { scheduledAt: "asc" }, take: 6,
    }) : [],
    seeQuotes ? prisma.quotation.count({ where: { status: { in: ["SENT", "VIEWED"] }, ...(own ? { salespersonId: id } : {}) } }) : 0,
    canApproveDiscount(role) ? prisma.quotation.count({ where: { requiresApproval: true, status: "DRAFT" } }) : 0,
    seeMoney ? prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }) : null,
    seeMoney ? prisma.invoice.findMany({ where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } }, select: { totalAmount: true, dueDate: true, payments: { select: { amount: true } } } }) : [],
    seeProjects ? prisma.project.count({ where: { stage: { not: "COMPLETED" } } }) : 0,
    seeTasks ? prisma.task.findMany({ where: { assigneeId: id, status: { not: "COMPLETED" } }, include: { project: { select: { projectNumber: true } } }, orderBy: [{ dueDate: "asc" }], take: 5 }) : [],
  ]);

  const outstanding = openInvoices.reduce((s, i) => s + Number(i.totalAmount) - i.payments.reduce((a, p) => a + Number(p.amount), 0), 0);
  const overdueInvoices = openInvoices.filter((i) => i.dueDate && i.dueDate < startOfToday).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-ink-soft">{greeting}, {name?.split(" ")[0]}</div>
          <h1 className="mt-0.5 text-[22px] font-bold text-ink">Here&apos;s today&apos;s overview</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(role, "quotations", "create") && <Link href="/quotations/new" className={btn.secondary}><Plus size={15} /> Quotation</Link>}
          {can(role, "invoices", "create") && can(role, "invoices", "financial") && <Link href="/invoices/new" className={btn.secondary}><Plus size={15} /> Invoice</Link>}
        </div>
      </div>

      {approvals > 0 && (
        <Link href="/quotations?status=APPROVAL" className="flex items-center gap-3 rounded-xl2 border border-warning/30 bg-warning-bg p-3.5">
          <ShieldCheck size={18} className="text-warning" />
          <span className="flex-1 text-[13.5px] font-semibold text-warning">{approvals} quotation{approvals > 1 ? "s need" : " needs"} your discount approval</span>
          <span className="text-[13px] font-semibold text-warning">Review →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {seeLeads && <StatCard label="Hot leads" value={hotLeads} sub={`${activeLeads} active total`} subTone="text-danger" icon={Flame} href="/leads?score=HOT" />}
        {seeFollowups && <StatCard label="Follow-ups today" value={todayFollowUps.length} sub={`${overdueLeads.length} overdue`} subTone={overdueLeads.length ? "text-warning" : "text-success"} icon={Clock} href="/followups" />}
        {seeQuotes && <StatCard label="Awaiting client" value={sentQuotes} sub="Quotations sent" subTone="text-primary" icon={FileText} href="/quotations?status=SENT" />}
        {seeMoney && <StatCard label="Collected this month" value={formatCurrency(paidThisMonth?._sum.amount?.toString() ?? 0)} sub="Payments received" subTone="text-success" icon={IndianRupee} href="/payments" />}
        {seeMoney && <StatCard label="Outstanding" value={formatCurrency(outstanding)} sub={`${overdueInvoices} invoice${overdueInvoices === 1 ? "" : "s"} overdue`} subTone={overdueInvoices ? "text-danger" : "text-ink-soft"} icon={Receipt} href="/invoices?status=UNPAID" />}
        {seeProjects && <StatCard label="Active projects" value={activeProjects} sub="In progress" subTone="text-primary" icon={Building2} href="/projects" />}
        {seeTasks && <StatCard label="My open tasks" value={myTasks.length} sub="Assigned to you" icon={ListChecks} href="/tasks" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {seeFollowups && (
          <div>
            <SectionHeader title="Today's follow-ups" actionHref="/followups" />
            <div className="flex flex-col gap-2.5">
              {todayFollowUps.length === 0 && <div className="rounded-xl2 border border-line bg-white p-4 text-[13.5px] text-ink-soft">No follow-ups scheduled for today.</div>}
              {todayFollowUps.map((f) => (
                <Link key={f.id} href={`/leads/${f.lead.id}`} className="flex items-center gap-3 rounded-xl2 border border-line bg-white p-3 hover:border-primary/30">
                  <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] bg-primary/10"><Clock size={16} className="text-primary" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-ink">{f.lead.name}</div>
                    <div className="text-xs text-ink-soft">{f.type.charAt(0) + f.type.slice(1).toLowerCase().replaceAll("_", " ")} · {formatDateTime(f.scheduledAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {seeLeads && (
          <div>
            <SectionHeader title="Attention required" actionHref="/followups" />
            <div className="flex flex-col gap-2.5">
              {overdueLeads.length === 0 && <div className="rounded-xl2 border border-line bg-white p-4 text-[13.5px] text-ink-soft">Nothing overdue — nice work.</div>}
              {overdueLeads.map((l) => (
                <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center gap-3 rounded-xl2 border border-danger/20 bg-white p-3 hover:border-danger/40">
                  <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] bg-danger-bg"><AlertTriangle size={16} className="text-danger" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-ink">{l.name}</div>
                    <div className="text-xs font-medium text-danger">Follow-up overdue since {formatDate(l.nextFollowUpAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {seeTasks && myTasks.length > 0 && (
          <div>
            <SectionHeader title="My tasks" actionHref="/tasks" />
            <MyTasks
              canEdit={can(role, "tasks", "edit")}
              tasks={myTasks.map((t) => ({
                id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate?.toISOString() ?? null,
                projectId: t.projectId, projectNumber: t.project?.projectNumber ?? null,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
