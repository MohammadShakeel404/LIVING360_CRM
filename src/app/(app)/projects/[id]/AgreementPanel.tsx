"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSignature, Send, CheckCircle2, Ban, RotateCcw, Pencil, Trash2, Loader2 } from "lucide-react";
import { StatusChip, btn, formatCurrency, formatDate } from "@/components/ui";
import { DocumentActions } from "@/components/DocumentActions";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";

export type AgreementSummary = {
  id: string; agreementNumber: string; workOrderNumber: string; status: string; contractValue: number; quotationNumber: string;
  agreementDate: string; signedAt: string | null; schedule: { label: string; pct: number }[];
  shareAgreement: string; shareWorkOrder: string;
};

export function AgreementPanel({
  projectId, agreement, canManage, client,
}: { projectId: string; agreement: AgreementSummary | null; canManage: boolean; client: { name: string; phone: string | null; email: string | null } }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  if (!agreement) {
    return (
      <div className="flex flex-col items-center gap-3 py-5 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10"><FileSignature size={20} className="text-primary" /></div>
        <div>
          <div className="text-[14px] font-semibold text-ink">No agreement yet</div>
          <div className="text-[12.5px] text-ink-soft">Create the client agreement and work order from the accepted quotation.</div>
        </div>
        {canManage && <Link href={`/projects/${projectId}/agreement`} className={btn.primary}><FileSignature size={15} /> Create agreement</Link>}
      </div>
    );
  }

  const a = agreement;
  async function act(action: string, confirm?: { title: string; message?: string; danger?: boolean }) {
    if (confirm && (await ask({ ...confirm, confirmLabel: "Yes, continue" })) === null) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/agreements/${a.id}`, action === "delete" ? { method: "DELETE" } : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      toast(data.message ?? "Agreement deleted.");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }
  const I = ({ k, icon: Icon }: { k: string; icon: any }) => (busy === k ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">{a.agreementNumber} <StatusChip status={a.status === "SIGNED" ? "APPROVED" : a.status} label={a.status === "SIGNED" ? "Signed" : undefined} /></div>
          <div className="text-[12.5px] text-ink-soft">
            {formatDate(a.agreementDate)} · based on {a.quotationNumber}{a.signedAt ? ` · signed ${formatDate(a.signedAt)}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11.5px] text-ink-soft">Contract value</div>
          <div className="text-[18px] font-bold text-primary">{formatCurrency(a.contractValue)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {a.schedule.map((m, i) => (
          <span key={i} className="rounded-full bg-line-soft px-2.5 py-1 text-[11.5px] font-medium text-ink-soft">
            {m.pct}% · {m.label} · <b className="text-ink">{formatCurrency((a.contractValue * m.pct) / 100)}</b>
          </span>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl2 border border-line p-3">
          <div className="mb-2 text-[12.5px] font-semibold text-ink-soft">Agreement</div>
          <DocumentActions pdfUrl={`/api/agreements/${a.id}/pdf`} sharePath={a.shareAgreement} filename={`${a.agreementNumber}-Agreement.pdf`} title={`Agreement ${a.agreementNumber}`} recipientName={client.name} phone={client.phone} email={client.email} />
        </div>
        <div className="rounded-xl2 border border-line p-3">
          <div className="mb-2 text-[12.5px] font-semibold text-ink-soft">Work order {a.workOrderNumber}</div>
          <DocumentActions pdfUrl={`/api/agreements/${a.id}/pdf?kind=workorder`} sharePath={a.shareWorkOrder} filename={`${a.workOrderNumber}-WorkOrder.pdf`} title={`Work order ${a.workOrderNumber}`} recipientName={client.name} phone={client.phone} email={client.email} />
        </div>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4 empty:hidden">
          {(a.status === "DRAFT" || a.status === "SENT") && <Link href={`/projects/${projectId}/agreement`} className={btn.secondary}><Pencil size={15} /> Edit</Link>}
          {a.status === "DRAFT" && <button disabled={busy !== null} onClick={() => act("send")} className={btn.primary}><I k="send" icon={Send} /> Mark as sent</button>}
          {(a.status === "DRAFT" || a.status === "SENT") && (
            <button disabled={busy !== null} onClick={() => act("sign", { title: "Mark the agreement as signed?", message: "Signed agreements can no longer be edited." })} className={btn.success}>
              <I k="sign" icon={CheckCircle2} /> Mark signed
            </button>
          )}
          {a.status !== "CANCELLED" && (
            <button disabled={busy !== null} onClick={() => act("cancel", { title: "Cancel this agreement?", message: "You can then create a new one for this project.", danger: true })} className={btn.danger}>
              <I k="cancel" icon={Ban} /> Cancel agreement
            </button>
          )}
          {a.status === "CANCELLED" && <button disabled={busy !== null} onClick={() => act("reopen")} className={btn.secondary}><I k="reopen" icon={RotateCcw} /> Reopen</button>}
          {a.status === "CANCELLED" && <Link href={`/projects/${projectId}/agreement`} className={btn.primary}><FileSignature size={15} /> New agreement</Link>}
          {a.status !== "SIGNED" && (
            <button disabled={busy !== null} onClick={() => act("delete", { title: "Delete this agreement permanently?", danger: true })} className={btn.danger + " md:ml-auto"}>
              <I k="delete" icon={Trash2} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
