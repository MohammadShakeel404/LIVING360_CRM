import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { MapPin, User, CalendarDays, Receipt, Plus, FilePlus2 } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, canManageContracts } from "@/lib/permissions";
import { changeOrderTotals, parseSchedule, workOrderNumber } from "@/lib/contracts";
import { sharePath } from "@/lib/settings";

import { effectiveInvoiceStatus } from "@/lib/invoices";
import { getTaskBoardData } from "@/lib/taskBoard";
import { docRows } from "@/lib/documents";
import { Card, MiniStat, PageHeader, StageTimeline, StatusChip, formatCurrency, formatDate, formatDateTime } from "@/components/ui";
import { TaskBoard } from "@/components/TaskBoard";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { ProjectControls } from "./ProjectControls";
import { AgreementPanel } from "./AgreementPanel";
import { ProjectLabour } from "./ProjectLabour";
import { assignmentSummary, labourSummary } from "@/lib/workers";
import { workerOptions } from "@/lib/workerData";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "projects", "view")) redirect("/dashboard");

  const p = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true, phone: true, email: true, lead: { select: { whatsapp: true } } } },
      agreements: { include: { quotation: { select: { quotationNumber: true } } }, orderBy: { createdAt: "desc" } },
      changeOrders: { include: { items: true }, orderBy: { createdAt: "desc" } },
      workers: {
        include: { worker: { select: { name: true, trade: true } }, stages: { orderBy: { sortOrder: "asc" } }, payments: { select: { amount: true, stageId: true } } },
        orderBy: { createdAt: "asc" },
      },
      projectManager: { select: { id: true, name: true } },
      invoices: { include: { payments: { select: { amount: true } } }, orderBy: { invoiceDate: "desc" } },
      siteVisits: { include: { assignedTo: { select: { name: true } } }, orderBy: { scheduledAt: "desc" }, take: 10 },
    },
  });
  if (!p) notFound();

  const financial = can(role, "projects", "financial");
  const [tasks, docs, managers] = await Promise.all([
    getTaskBoardData({ projectId: p.id }),
    can(role, "documents", "view") ? docRows({ projectId: p.id }) : Promise.resolve(null),
    prisma.user.findMany({ where: { status: "ACTIVE", role: { in: ["PROJECT_MANAGER", "ADMIN", "SUPER_ADMIN"] } }, select: { id: true, name: true } }),
  ]);
  const invoices = p.invoices.map((i) => {
    const total = Number(i.totalAmount);
    const paid = i.payments.reduce((s, x) => s + Number(x.amount), 0);
    return { ...i, total, paid, status: effectiveInvoiceStatus(i.status, total, paid, i.dueDate) };
  });
  const live = invoices.filter((i) => i.status !== "CANCELLED" && i.status !== "DRAFT");
  const billed = live.reduce((s, i) => s + i.total, 0);
  const received = live.reduce((s, i) => s + i.paid, 0);
  const agreement = p.agreements.find((a) => a.status !== "CANCELLED") ?? p.agreements[0] ?? null;
  const manageContracts = canManageContracts(role);
  const cosRows = p.changeOrders.map((c) => ({ ...c, t: changeOrderTotals(c.items) }));
  const seeWorkers = can(role, "workers", "view");
  const workerMoney = can(role, "workers", "financial");
  const labourRows = p.workers.map((a) => {
    const s = assignmentSummary(a);
    return { id: a.id, workerName: a.worker.name, trade: a.worker.trade, scope: a.scope, status: a.status, payable: s.payable, paid: s.paid, balance: s.balance, stages: s.stages };
  });
  const labour = labourSummary(labourRows);
  const canAssignWorkers = can(role, "workers", "create") && workerMoney;
  const approvedCosNet = cosRows.filter((c) => c.status === "APPROVED").reduce((s, c) => s + c.t.net, 0);
  const late = p.expectedCompletion && p.expectedCompletion < new Date() && p.stage !== "COMPLETED";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back="/projects"
        title={`${p.client.name}`}
        subtitle={<span className="flex flex-wrap items-center gap-2">{p.projectNumber} <StatusChip status={p.stage} /></span>}
      />

      <Card>
        <StageTimeline currentStage={p.stage} />
        {can(role, "projects", "edit") && (
          <ProjectControls
            project={{
              id: p.id, stage: p.stage, projectManagerId: p.projectManagerId, siteLocation: p.siteLocation,
              startDate: p.startDate?.toISOString().slice(0, 10) ?? "", expectedCompletion: p.expectedCompletion?.toISOString().slice(0, 10) ?? "",
              budget: financial && p.budget ? String(Number(p.budget)) : "", value: financial && p.value ? String(Number(p.value)) : "",
            }}
            managers={managers}
            financial={financial}
            canDelete={can(role, "projects", "delete")}
          />
        )}
      </Card>

      {financial && (
        <Card title="Agreement & work order" subtitle="Client contract generated from the accepted quotation.">
          <AgreementPanel
            projectId={p.id}
            canManage={manageContracts}
            client={{ name: p.client.name, phone: p.client.lead?.whatsapp ?? p.client.phone, email: p.client.email }}
            agreement={
              agreement
                ? {
                    id: agreement.id, agreementNumber: agreement.agreementNumber, workOrderNumber: workOrderNumber(agreement.agreementNumber),
                    status: agreement.status, contractValue: Number(agreement.contractValue), quotationNumber: agreement.quotation.quotationNumber,
                    agreementDate: agreement.agreementDate.toISOString(), signedAt: agreement.signedAt?.toISOString() ?? null,
                    schedule: parseSchedule(agreement.paymentSchedule),
                    shareAgreement: sharePath("agreement", agreement.id), shareWorkOrder: sharePath("workorder", agreement.id),
                  }
                : null
            }
          />
        </Card>
      )}

      {financial && (
        <Card
          title="Change of scope (COS)"
          subtitle={cosRows.length ? `Approved changes: ${approvedCosNet < 0 ? "− " : "+ "}${formatCurrency(Math.abs(approvedCosNet))}` : "Additions or deductions agreed after the quotation."}
          action={manageContracts ? <Link href={`/projects/${p.id}/cos/new`} className="flex items-center gap-1 text-[13px] font-semibold text-primary"><FilePlus2 size={14} /> New COS</Link> : undefined}
        >
          {cosRows.length === 0 ? (
            <div className="py-3 text-center text-[13px] text-ink-soft">No changes of scope yet.</div>
          ) : (
            <div className="-m-4">
              {cosRows.map((c) => (
                <Link key={c.id} href={`/projects/${p.id}/cos/${c.id}`} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-primary">{c.cosNumber}</div>
                    <div className="truncate text-[12px] text-ink-faint">{c.title} · {formatDate(c.createdAt)}</div>
                  </div>
                  <span className="flex flex-shrink-0 items-center gap-2.5">
                    <span className={`text-[13px] font-semibold ${c.t.net < 0 ? "text-danger" : "text-ink"}`}>{c.t.net < 0 ? "− " : "+ "}{formatCurrency(Math.abs(c.t.net))}</span>
                    <StatusChip status={c.status} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
            <span className="flex items-center gap-2"><User size={14} /> {p.projectManager?.name ?? "No project manager"}</span>
            <span className="flex items-center gap-2"><MapPin size={14} /> {p.siteLocation ?? "—"}</span>
            <span className="flex items-center gap-2"><CalendarDays size={14} /> {formatDate(p.startDate)} → <b className={late ? "text-danger" : "text-ink"}>{formatDate(p.expectedCompletion)}</b></span>
            <Link href={`/clients/${p.client.id}`} className="mt-1 text-[12.5px] font-semibold text-primary">Open client →</Link>
          </div>
        </Card>
        {financial ? (
          <>
            <MiniStat
              label="Contract value"
              value={formatCurrency(p.value?.toString())}
              sub={[approvedCosNet ? `incl. COS ${approvedCosNet < 0 ? "−" : "+"}${formatCurrency(Math.abs(approvedCosNet))}` : "", p.budget ? `Budget ${formatCurrency(p.budget.toString())}` : ""].filter(Boolean).join(" · ") || undefined}
            />
            <MiniStat label="Billed / received" value={`${formatCurrency(billed)}`} sub={`${formatCurrency(received)} received`} tone="text-ink" />
          </>
        ) : (
          <div className="md:col-span-2" />
        )}
      </div>

      {seeWorkers && (
        <Card title="Workers & labour cost" subtitle="Who is working on this project, what they're owed and what's been paid.">
          <ProjectLabour
            projectId={p.id}
            rows={workerMoney ? labourRows : labourRows.map((r) => ({ ...r, payable: 0, paid: 0, balance: 0, stages: [] }))}
            summary={workerMoney ? labour : { payable: 0, paid: 0, balance: 0, byTrade: [] }}
            contractValue={financial && p.value ? Number(p.value) : null}
            financial={workerMoney}
            canAssign={canAssignWorkers && p.stage !== "COMPLETED"}
            canPay={canAssignWorkers}
            workers={canAssignWorkers ? await workerOptions() : []}
          />
        </Card>
      )}

      <div>
        <div className="mb-2.5 text-[15px] font-semibold text-ink">Tasks</div>
        <TaskBoard {...tasks} projectId={p.id} canCreate={can(role, "tasks", "create")} canEdit={can(role, "tasks", "edit")} canDelete={can(role, "tasks", "delete")} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {can(role, "invoices", "view") && (
          <Card
            title="Invoices"
            action={can(role, "invoices", "create") && can(role, "invoices", "financial") ? <Link href={`/invoices/new?clientId=${p.client.id}&projectId=${p.id}`} className="flex items-center gap-1 text-[13px] font-semibold text-primary"><Plus size={14} /> New</Link> : undefined}
          >
            {invoices.length === 0 ? <div className="flex flex-col items-center gap-2 py-4 text-[13px] text-ink-soft"><Receipt size={20} className="text-ink-faint" /> No invoices for this project.</div> : (
              <div className="-m-4">
                {invoices.map((i) => (
                  <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center justify-between border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg">
                    <span className="text-[13.5px] font-semibold text-primary">{i.invoiceNumber}</span>
                    <span className="flex items-center gap-2.5">{can(role, "invoices", "financial") && <span className="text-[13px] font-semibold">{formatCurrency(i.total)}</span>}<StatusChip status={i.status} /></span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}
        {can(role, "sitevisits", "view") && (
          <Card title="Site visits" action={can(role, "sitevisits", "create") ? <Link href={`/sitevisits?projectId=${p.id}`} className="flex items-center gap-1 text-[13px] font-semibold text-primary"><Plus size={14} /> Schedule</Link> : undefined}>
            {p.siteVisits.length === 0 ? <div className="py-4 text-center text-[13px] text-ink-soft">No site visits yet.</div> : (
              <div className="-m-4">
                {p.siteVisits.map((v) => (
                  <div key={v.id} className="flex items-center justify-between border-b border-line-soft px-4 py-3 text-[13px] last:border-0">
                    <span>{formatDateTime(v.scheduledAt)} · {v.assignedTo?.name ?? "—"}</span>
                    <span className={`text-[11px] font-bold ${v.completedAt ? "text-success" : "text-[#4A7FC9]"}`}>{v.completedAt ? "DONE" : "SCHEDULED"}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {docs && (
        <div>
          <div className="mb-2.5 text-[15px] font-semibold text-ink">Documents</div>
          <DocumentsPanel docs={docs} userId={session!.user.id} canUpload={can(role, "documents", "create")} canDeleteAll={can(role, "documents", "delete")} target={{ projectId: p.id }} />
        </div>
      )}
    </div>
  );
}
