"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, FileText, HardHat, IndianRupee } from "lucide-react";
import { toLocalInput } from "@/lib/labels";
import { btn, formatCurrency } from "@/components/ui";
import { AssignmentForm, type WorkerOption } from "@/components/workers/AssignmentForm";
import { PaymentForm, type StageBalance } from "@/components/workers/PaymentForm";

export type LabourRow = {
  id: string; workerName: string; trade: string; scope: string; status: string;
  payable: number; paid: number; balance: number; stages: StageBalance[];
};
type Summary = { payable: number; paid: number; balance: number; byTrade: { trade: string; workers: number; payable: number; paid: number; balance: number }[] };

/** Workers engaged on the project and what the labour costs — payable, paid, still to pay. */
export function ProjectLabour({
  projectId, rows, summary, contractValue, financial, canAssign, canPay, workers,
}: {
  projectId: string; rows: LabourRow[]; summary: Summary; contractValue: number | null; financial: boolean;
  canAssign: boolean; canPay: boolean; workers: WorkerOption[];
}) {
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<LabourRow | null>(null);
  const share = contractValue ? (summary.payable / contractValue) * 100 : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12.5px] text-ink-soft">{rows.length} worker{rows.length === 1 ? "" : "s"} engaged{share !== null && financial ? ` · labour is ${share.toFixed(1)}% of the contract value` : ""}</div>
        <div className="flex flex-wrap gap-2">
          {financial && rows.length > 0 && <a href={`/api/projects/${projectId}/labour`} className={btn.secondary}><FileText size={15} /> Labour statement</a>}
          {canAssign && <button onClick={() => setAdding(true)} className={btn.primary}><UserPlus size={15} /> Add worker</button>}
        </div>
      </div>

      {financial && rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl2 bg-appbg p-3"><div className="text-[11.5px] text-ink-soft">Labour payable</div><div className="text-[17px] font-bold text-ink">{formatCurrency(summary.payable)}</div></div>
            <div className="rounded-xl2 bg-success-bg p-3"><div className="text-[11.5px] text-ink-soft">Paid</div><div className="text-[17px] font-bold text-success">{formatCurrency(summary.paid)}</div></div>
            <div className="rounded-xl2 bg-warning-bg p-3"><div className="text-[11.5px] text-ink-soft">Still to pay</div><div className="text-[17px] font-bold text-warning">{formatCurrency(summary.balance)}</div></div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {summary.byTrade.map((t) => (
              <span key={t.trade} className="rounded-full bg-line-soft px-2.5 py-1 text-[11.5px] text-ink-soft">
                <b className="text-ink">{t.trade}</b> · {t.workers} · {formatCurrency(t.payable)}{t.balance > 0.5 ? <span className="text-warning"> ({formatCurrency(t.balance)} due)</span> : null}
              </span>
            ))}
          </div>
        </>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl2 border border-dashed border-line py-6 text-center text-[13px] text-ink-soft">
          <HardHat size={22} className="text-ink-faint" /> No workers on this project yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl2 border border-line">
          {rows.map((r) => {
            const pct = r.payable ? Math.min(100, (r.paid / r.payable) * 100) : 0;
            return (
              <div key={r.id} className="flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg/60">
                <Link href={`/projects/${projectId}/workers/${r.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold text-ink">{r.workerName}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{r.trade}</span>
                    {r.status === "COMPLETED" && <span className="text-[11px] font-semibold text-success">Done</span>}
                  </div>
                  <div className="truncate text-[12.5px] text-ink-soft">{r.scope}</div>
                  {financial && (
                    <>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div>
                      <div className="mt-1 flex justify-between text-[11.5px]">
                        <span className="text-ink-soft">{formatCurrency(r.paid)} of {formatCurrency(r.payable)}</span>
                        <span className={r.balance > 0.5 ? "font-semibold text-warning" : "font-semibold text-success"}>{r.balance > 0.5 ? `${formatCurrency(r.balance)} due` : "Settled"}</span>
                      </div>
                    </>
                  )}
                </Link>
                {canPay && r.balance > 0.5 && (
                  <button onClick={() => setPaying(r)} className="flex-shrink-0 rounded-lg bg-success-bg p-2 text-success hover:bg-success/15" aria-label={`Pay ${r.workerName}`} title={`Pay ${r.workerName}`}>
                    <IndianRupee size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <AssignmentForm
          workers={workers}
          onClose={() => setAdding(false)}
          initial={{ workerId: "", projectId, scope: "", rateType: "LUMP_SUM", rate: "", quantity: "", unit: "days", agreedAmount: "", startDate: toLocalInput(new Date()).slice(0, 10), endDate: "", notes: "", stages: [] }}
        />
      )}
      {paying && <PaymentForm assignmentId={paying.id} workerName={paying.workerName} balance={paying.balance} stages={paying.stages} onClose={() => setPaying(null)} />}
    </div>
  );
}
