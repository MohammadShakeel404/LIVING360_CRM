import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Phone, MessageCircle, MapPin, CreditCard, Landmark, Wallet, StickyNote } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { assignmentSummary, RATE_TYPE_LABEL } from "@/lib/workers";
import { workerOptions, receiptRow } from "@/lib/workerData";
import { Avatar, Card, MiniStat, PageHeader, StatusChip, formatCurrency, formatDate } from "@/components/ui";
import { ReceiptRow } from "@/components/workers/ReceiptRow";
import { WorkerActions } from "./WorkerActions";

export default async function WorkerPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "workers", "view")) redirect("/dashboard");
  const financial = can(role, "workers", "financial");

  const w = await prisma.worker.findUnique({
    where: { id: params.id },
    include: {
      assignments: {
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, projectNumber: true, stage: true, client: { select: { name: true } } } },
          stages: { orderBy: { sortOrder: "asc" } },
          payments: { include: { stage: { select: { label: true } } }, orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }] },
        },
      },
    },
  });
  if (!w) notFound();

  const rows = w.assignments.map((a) => ({ a, s: assignmentSummary(a) }));
  const totals = rows.reduce((t, r) => ({ payable: t.payable + r.s.payable, paid: t.paid + r.s.paid, balance: t.balance + r.s.balance }), { payable: 0, paid: 0, balance: 0 });
  const payments = w.assignments
    .flatMap((a) => a.payments.map((p) => ({ p, ctx: a.project.projectNumber })))
    .sort((x, y) => y.p.paidAt.getTime() - x.p.paidAt.getTime() || y.p.createdAt.getTime() - x.p.createdAt.getTime());
  const wa = w.phone.replace(/\D/g, "");

  const [options, projects] = can(role, "workers", "create") && financial
    ? await Promise.all([
        workerOptions(w.id),
        prisma.project.findMany({ where: { stage: { not: "COMPLETED" } }, select: { id: true, projectNumber: true, client: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
      ])
    : [[], []];

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-5">
      <PageHeader
        back="/workers"
        title={w.name}
        subtitle={<span className="flex flex-wrap items-center gap-2">{w.trade} · {w.workerNumber} {w.status === "INACTIVE" && <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-bold text-ink-faint">INACTIVE</span>}</span>}
      />

      <WorkerActions
        worker={{
          id: w.id, name: w.name, trade: w.trade, phone: w.phone, altPhone: w.altPhone ?? "", address: w.address ?? "", idProof: w.idProof ?? "",
          bankName: w.bankName ?? "", accountName: w.accountName ?? "", accountNumber: w.accountNumber ?? "", ifsc: w.ifsc ?? "", upiId: w.upiId ?? "",
          defaultRate: w.defaultRate ? String(Number(w.defaultRate)) : "", defaultRateType: w.defaultRateType ?? "DAILY", notes: w.notes ?? "",
        }}
        status={w.status}
        hasHistory={w.assignments.length > 0}
        canEdit={can(role, "workers", "edit")}
        canDelete={can(role, "workers", "delete")}
        canAssign={can(role, "workers", "create") && financial && w.status === "ACTIVE"}
        financial={financial}
        workers={options}
        projects={projects.map((p) => ({ id: p.id, label: `${p.projectNumber} · ${p.client.name}` }))}
      />

      {financial && (
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Total payable" value={formatCurrency(totals.payable)} sub={`${rows.length} work record${rows.length === 1 ? "" : "s"}`} />
          <MiniStat label="Paid" value={formatCurrency(totals.paid)} tone="text-success" sub={`${payments.length} payments`} />
          <MiniStat label="Balance" value={formatCurrency(totals.balance)} tone={totals.balance > 0.5 ? "text-warning" : "text-success"} />
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-[300px_1fr]">
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={w.name} size={48} tone="bg-dark" />
            <div>
              <div className="text-[16px] font-bold text-ink">{w.name}</div>
              <div className="text-[12.5px] text-primary">{w.trade}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:${w.phone}`} className="flex items-center justify-center gap-1.5 rounded-xl2 bg-success-bg py-2 text-[12.5px] font-semibold text-success"><Phone size={14} /> Call</a>
            <a href={`https://wa.me/${wa.length === 10 ? "91" + wa : wa}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl2 bg-[#25D366]/15 py-2 text-[12.5px] font-semibold text-[#128C4B]"><MessageCircle size={14} /> WhatsApp</a>
          </div>
          <div className="mt-4 flex flex-col gap-2 text-[13px] text-ink-soft">
            <span className="flex items-center gap-2"><Phone size={14} /> {w.phone}{w.altPhone ? ` / ${w.altPhone}` : ""}</span>
            {w.address && <span className="flex items-start gap-2"><MapPin size={14} className="mt-0.5" /> {w.address}</span>}
            {w.idProof && <span className="flex items-center gap-2"><CreditCard size={14} /> {w.idProof}</span>}
            {w.defaultRate && <span className="flex items-center gap-2"><Wallet size={14} /> Usual rate {formatCurrency(w.defaultRate.toString())} · {w.defaultRateType ? RATE_TYPE_LABEL[w.defaultRateType].toLowerCase() : ""}</span>}
            {(w.upiId || w.accountNumber) && (
              <span className="flex items-start gap-2"><Landmark size={14} className="mt-0.5" />
                <span>{w.upiId && <>UPI {w.upiId}<br /></>}{w.accountNumber && <>A/c {w.accountNumber}{w.ifsc ? ` · ${w.ifsc}` : ""}{w.bankName ? <><br />{w.bankName}</> : null}</>}</span>
              </span>
            )}
            {w.notes && <span className="flex items-start gap-2"><StickyNote size={14} className="mt-0.5" /> {w.notes}</span>}
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Projects & work">
            {rows.length === 0 ? (
              <div className="py-4 text-center text-[13px] text-ink-soft">Not assigned to any project yet.</div>
            ) : (
              <div className="-m-4">
                {rows.map(({ a, s }) => {
                  const pct = s.payable ? Math.min(100, (s.paid / s.payable) * 100) : 0;
                  return (
                    <Link key={a.id} href={`/projects/${a.project.id}/workers/${a.id}`} className="block border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold text-primary">{a.project.projectNumber} · {a.project.client.name}</div>
                          <div className="truncate text-[12.5px] text-ink-soft">{a.scope}</div>
                          <div className="text-[11.5px] text-ink-faint">{formatDate(a.startDate ?? a.createdAt)}{a.stages.length ? ` · ${a.stages.length} stages` : ""}</div>
                        </div>
                        <StatusChip status={a.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS"} label={a.status === "COMPLETED" ? "Completed" : "Working"} />
                      </div>
                      {financial && (
                        <>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div>
                          <div className="mt-1 flex justify-between text-[12px]">
                            <span className="text-ink-soft">Paid {formatCurrency(s.paid)} of {formatCurrency(s.payable)}</span>
                            <span className={s.balance > 0.5 ? "font-semibold text-warning" : "font-semibold text-success"}>{s.balance > 0.5 ? `${formatCurrency(s.balance)} due` : "Settled"}</span>
                          </div>
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {financial && (
            <Card title="Payment history" subtitle={payments.length ? `${payments.length} payments · ${formatCurrency(totals.paid)}` : undefined}>
              {payments.length === 0 ? (
                <div className="py-4 text-center text-[13px] text-ink-soft">No payments yet.</div>
              ) : (
                <div className="-m-4">
                  {payments.map(({ p, ctx }) => <ReceiptRow key={p.id} r={receiptRow(p, w, ctx)} canDelete={can(role, "workers", "delete")} />)}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
