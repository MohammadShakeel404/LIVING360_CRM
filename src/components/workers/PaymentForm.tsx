"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Field, inputCls, btn, formatCurrency } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { PAYMENT_METHODS, humanize, toLocalInput } from "@/lib/labels";

export type StageBalance = { id: string; label: string; amount: number; paid: number; balance: number };

/** Record money paid to a worker — against a stage or as a direct / advance payment. */
export function PaymentForm({
  assignmentId, workerName, balance, stages, onClose, onPaid,
}: { assignmentId: string; workerName: string; balance: number; stages: StageBalance[]; onClose: () => void; onPaid?: (receiptId: string) => void }) {
  const router = useRouter();
  const firstOpen = stages.find((s) => s.balance > 0);
  const [stageId, setStageId] = useState(firstOpen?.id ?? "");
  const stage = stages.find((s) => s.id === stageId);
  const [amount, setAmount] = useState(String(Math.min(stage?.balance ?? balance, balance)));
  const [method, setMethod] = useState("UPI");
  const [ref, setRef] = useState("");
  const today = toLocalInput(new Date()).slice(0, 10);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const tooMuch = n > balance + 0.5;

  function pickStage(id: string) {
    setStageId(id);
    const st = stages.find((s) => s.id === id);
    setAmount(String(Math.min(st ? st.balance : balance, balance)));
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/workers/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, stageId: stageId || null, amount: n, method, referenceNumber: ref, notes, paidAt: date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't record the payment.");
      toast(data.message ?? "Payment recorded.");
      onClose();
      onPaid?.(data.payment.id);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal
      open onClose={onClose} title={`Pay ${workerName}`}
      footer={<button disabled={busy || !(n > 0) || tooMuch} onClick={save} className={btn.success + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} Save payment & create receipt</button>}
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-lg bg-appbg px-3 py-2 text-[13px] text-ink-soft">Still payable on this work: <b className="text-ink">{formatCurrency(balance)}</b></div>
        {stages.length > 0 && (
          <Field label="Paying for">
            <div className="flex flex-col gap-1.5">
              {stages.map((s) => (
                <button key={s.id} type="button" onClick={() => pickStage(s.id)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[13px] ${stageId === s.id ? "border-primary bg-primary/5" : "border-line"}`}>
                  <span className="font-semibold text-ink">{s.label}</span>
                  <span className={s.balance > 0 ? "text-ink-soft" : "font-semibold text-success"}>{s.balance > 0 ? `${formatCurrency(s.balance)} due of ${formatCurrency(s.amount)}` : "Paid"}</span>
                </button>
              ))}
              <button type="button" onClick={() => pickStage("")} className={`rounded-lg border px-3 py-2 text-left text-[13px] font-semibold ${stageId === "" ? "border-primary bg-primary/5" : "border-line"}`}>Direct / advance (not a stage)</button>
            </div>
          </Field>
        )}
        <Field label="Amount paid (₹)" hint={tooMuch ? "More than the balance — edit the work to increase the payable amount first." : stage && n > stage.balance + 0.5 ? "More than this stage's balance; the extra counts towards the total." : undefined}>
          <input type="number" min={0} step="any" autoFocus className={inputCls + " text-[17px] font-semibold"} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Paid by">
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)} className={`rounded-lg border px-2 py-2 text-[12.5px] font-semibold ${method === m ? "border-primary bg-primary/10 text-primary" : "border-line text-ink-soft"}`}>
                {m === "UPI" ? "UPI" : humanize(m)}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reference / UTR"><input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          <Field label="Date"><input type="date" className={inputCls} value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
