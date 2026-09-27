import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Phone, CalendarDays, Calculator } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { assignmentSummary } from "@/lib/workers";
import { workerOptions, receiptRow } from "@/lib/workerData";
import { Card, MiniStat, PageHeader, StatusChip, formatCurrency, formatDate } from "@/components/ui";
import { ReceiptRow } from "@/components/workers/ReceiptRow";
import { AssignmentActions } from "./AssignmentActions";

/** One worker's work on one project: agreed pay, stage-wise breakdown and every payment. */
export default async function AssignmentPage({ params }: { params: { id: string; assignmentId: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "workers", "view")) redirect("/dashboard");
  const financial = can(role, "workers", "financial");

  const a = await prisma.projectWorker.findUnique({
    where: { id: params.assignmentId },
    include: {
      worker: true,
      project: { select: { id: true, projectNumber: true, client: { select: { name: true } } } },
      stages: { orderBy: { sortOrder: "asc" } },
      payments: { include: { stage: { select: { label: true } }, recordedBy: { select: { name: true } } }, orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!a || a.projectId !== params.id) notFound();

  const s = assignmentSummary(a);
  const pct = s.payable ? Math.min(100, (s.paid / s.payable) * 100) : 0;
  const canPay = can(role, "workers", "create") && financial;
  const canEdit = can(role, "workers", "edit") && financial;

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-5">
      <PageHeader
        back={`/projects/${a.project.id}`}
        title={`${a.worker.name} — ${a.worker.trade}`}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Link href={`/projects/${a.project.id}`} className="text-primary hover:underline">{a.project.projectNumber} · {a.project.client.name}</Link> <StatusChip status={a.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS"} label={a.status === "COMPLETED" ? "Completed" : "Working"} /></span>}
      />

      {(canPay || canEdit) && (
        <AssignmentActions
          assignmentId={a.id}
          projectId={a.project.id}
          workerName={a.worker.name}
          status={a.status}
          balance={s.balance}
          stages={s.stages}
          hasPayments={a.payments.length > 0}
          canPay={canPay && s.balance > 0.5}
          canEdit={canEdit}
          workers={canEdit ? await workerOptions(a.workerId) : []}
          form={{
            id: a.id, workerId: a.workerId, projectId: a.projectId, scope: a.scope, rateType: a.rateType,
            rate: a.rate ? String(Number(a.rate)) : "", quantity: a.quantity ? String(Number(a.quantity)) : "", unit: a.unit ?? "",
            agreedAmount: String(Number(a.agreedAmount)), startDate: a.startDate?.toISOString().slice(0, 10) ?? "", endDate: a.endDate?.toISOString().slice(0, 10) ?? "",
            notes: a.notes ?? "", stages: a.stages.map((st) => ({ id: st.id, label: st.label, amount: String(Number(st.amount)) })), paid: s.paid,
          }}
        />
      )}

      {financial && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Payable" value={formatCurrency(s.payable)} />
            <MiniStat label="Paid" value={formatCurrency(s.paid)} tone="text-success" sub={`${a.payments.length} payment${a.payments.length === 1 ? "" : "s"}`} />
            <MiniStat label="Balance" value={formatCurrency(s.balance)} tone={s.balance > 0.5 ? "text-warning" : "text-success"} sub={s.balance > 0.5 ? undefined : "Fully paid"} />
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-line-soft" title={`${pct.toFixed(0)}% paid`}><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div>
        </>
      )}

      <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
        <Card title="Work">
          <div className="flex flex-col gap-2 text-[13.5px]">
            <div className="font-medium text-ink">{a.scope}</div>
            {financial && (
              <div className="flex items-center gap-2 text-ink-soft">
                <Calculator size={14} />
                {a.rateType === "LUMP_SUM" ? `Fixed amount ${formatCurrency(s.payable)}` : `${formatCurrency(a.rate?.toString())} × ${Number(a.quantity)} ${a.unit ?? ""} = ${formatCurrency(s.payable)}`}
              </div>
            )}
            <div className="flex items-center gap-2 text-ink-soft"><CalendarDays size={14} /> {a.startDate ? formatDate(a.startDate) : `Added ${formatDate(a.createdAt)}`} → {a.endDate ? formatDate(a.endDate) : "ongoing"}</div>
            <a href={`tel:${a.worker.phone}`} className="flex items-center gap-2 text-ink-soft hover:text-primary"><Phone size={14} /> {a.worker.phone}</a>
            {a.notes && <div className="rounded-lg bg-appbg p-2.5 text-[12.5px] text-ink-soft">{a.notes}</div>}
            <Link href={`/workers/${a.workerId}`} className="text-[12.5px] font-semibold text-primary">Open {a.worker.name}&apos;s profile →</Link>
          </div>
        </Card>

        {financial && (
          <Card title="Stage-wise breakdown" subtitle={s.stages.length ? undefined : "No stage plan — payments are recorded as direct / advance."}>
            {s.stages.length > 0 ? (
              <div className="-m-4 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-appbg text-left text-[11.5px] font-semibold text-ink-soft">
                      <th className="px-4 py-2.5">Stage</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5 text-right">Paid</th><th className="px-4 py-2.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.stages.map((st) => (
                      <tr key={st.id} className="border-b border-line-soft">
                        <td className="px-4 py-2.5 font-medium text-ink">{st.label}</td>
                        <td className="px-3 py-2.5 text-right">{formatCurrency(st.amount)}</td>
                        <td className="px-3 py-2.5 text-right text-success">{formatCurrency(st.paid)}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${st.balance > 0.5 ? "text-warning" : "text-success"}`}>{st.balance > 0.5 ? formatCurrency(st.balance) : "Paid"}</td>
                      </tr>
                    ))}
                    {s.direct > 0 && (
                      <tr className="border-b border-line-soft">
                        <td className="px-4 py-2.5 text-ink-soft">Direct / advance <span className="block text-[11px] text-ink-faint">adjusted against the stages above</span></td>
                        <td className="px-3 py-2.5 text-right text-ink-faint">—</td>
                        <td className="px-3 py-2.5 text-right text-success">{formatCurrency(s.direct)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-success">− {formatCurrency(s.direct)}</td>
                      </tr>
                    )}
                    <tr className="bg-appbg font-bold">
                      <td className="px-4 py-2.5">Total</td><td className="px-3 py-2.5 text-right">{formatCurrency(s.payable)}</td>
                      <td className="px-3 py-2.5 text-right text-success">{formatCurrency(s.paid)}</td><td className="px-4 py-2.5 text-right">{formatCurrency(s.balance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex justify-between text-[13.5px]"><span className="text-ink-soft">Paid directly</span><b>{formatCurrency(s.direct)}</b></div>
            )}
          </Card>
        )}
      </div>

      {financial && (
        <Card title="Payments & receipts" subtitle="Download or WhatsApp a receipt to the worker for every payment.">
          {a.payments.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-ink-soft">No payments recorded yet.</div>
          ) : (
            <div className="-m-4">
              {a.payments.map((p) => <ReceiptRow key={p.id} r={receiptRow(p, a.worker, `by ${p.recordedBy.name}`)} canDelete={can(role, "workers", "delete")} />)}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
