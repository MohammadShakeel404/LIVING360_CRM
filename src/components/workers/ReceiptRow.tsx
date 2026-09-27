"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, MessageCircle, Trash2, Loader2 } from "lucide-react";
import { MethodChip, formatCurrency, formatDate } from "@/components/ui";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";

export type ReceiptRowData = {
  id: string; receiptNumber: string; amount: number; method: string; paidAt: string; referenceNumber: string | null;
  stageLabel: string | null; context?: string; sharePath: string; workerName: string; workerPhone: string;
};

/** One worker payment: amount, stage, and quick receipt actions (download, WhatsApp, delete). */
export function ReceiptRow({ r, canDelete }: { r: ReceiptRowData; canDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const digits = r.workerPhone.replace(/\D/g, "");
  const wa = `https://wa.me/${digits.length === 10 ? "91" + digits : digits}?text=${encodeURIComponent(
    `Namaste ${r.workerName.split(" ")[0]}, payment of ${formatCurrency(r.amount)} received on ${formatDate(r.paidAt)}${r.stageLabel ? ` (${r.stageLabel})` : ""}. Receipt ${r.receiptNumber}: ${origin}${r.sharePath}`
  )}`;

  async function remove() {
    if ((await ask({ title: `Remove payment ${r.receiptNumber}?`, message: "The balance for this work goes back up by this amount.", danger: true, confirmLabel: "Remove" })) === null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workers/payments/${r.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't remove.");
      toast(data.message ?? "Payment removed.");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
          {formatCurrency(r.amount)} <MethodChip method={r.method} />
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{r.stageLabel ?? "Direct / advance"}</span>
        </div>
        <div className="truncate text-[12px] text-ink-faint">
          {r.receiptNumber} · {formatDate(r.paidAt)}{r.referenceNumber ? ` · Ref ${r.referenceNumber}` : ""}{r.context ? ` · ${r.context}` : ""}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-0.5">
        <a href={`/api/workers/payments/${r.id}/pdf`} aria-label="Download receipt" title="Download receipt" className="rounded-lg p-2 text-ink-soft hover:bg-appbg hover:text-primary"><Download size={16} /></a>
        <a href={wa} target="_blank" rel="noreferrer" aria-label="Send receipt on WhatsApp" title="Send receipt on WhatsApp" className="rounded-lg p-2 text-[#128C4B] hover:bg-[#25D366]/10"><MessageCircle size={16} /></a>
        {canDelete && (
          <button aria-label="Remove payment" title="Remove payment" disabled={busy} onClick={remove} className="rounded-lg p-2 text-ink-faint hover:bg-danger-bg hover:text-danger">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}
