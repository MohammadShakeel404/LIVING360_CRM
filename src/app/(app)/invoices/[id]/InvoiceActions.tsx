"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, IndianRupee, Pencil, Ban, RotateCcw, Trash2, Loader2, CalendarClock } from "lucide-react";
import { Field, inputCls, btn } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";
import { PAYMENT_METHODS, humanize, toLocalInput } from "@/lib/labels";

async function call(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export function InvoiceActions({
  id, status, balance, dueDate, hasPayments, canEdit, canDelete, canPay,
}: {
  id: string; status: string; balance: number; dueDate: string; hasPayments: boolean; canEdit: boolean; canDelete: boolean; canPay: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<"pay" | "due" | null>(null);

  async function run(key: string, fn: () => Promise<any>, ok?: string, after?: () => void) {
    setBusy(key);
    try {
      const data = await fn();
      toast(data?.message ?? ok ?? "Saved.");
      setModal(null);
      after ? after() : router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }
  const patch = (action: string, extra?: object) => () => run(action, () => call(`/api/invoices/${id}`, "PATCH", { action, ...extra }));
  const Spin = ({ k, icon: Icon }: { k: string; icon: any }) => (busy === k ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />);

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4 empty:hidden">
      {status === "DRAFT" && canEdit && (
        <>
          <Link href={`/invoices/${id}/edit`} className={btn.secondary}><Pencil size={15} /> Edit</Link>
          <button disabled={busy !== null} onClick={patch("send")} className={btn.primary}><Spin k="send" icon={Send} /> Issue invoice</button>
        </>
      )}
      {canPay && balance > 0 && status !== "CANCELLED" && (
        <button onClick={() => setModal("pay")} className={btn.success}><IndianRupee size={15} /> Record payment</button>
      )}
      {canEdit && status !== "CANCELLED" && balance > 0 && (
        <button onClick={() => setModal("due")} className={btn.secondary}><CalendarClock size={15} /> Change due date</button>
      )}
      {canEdit && status !== "CANCELLED" && !hasPayments && (
        <button disabled={busy !== null} onClick={async () => (await ask({ title: "Cancel this invoice?", message: "It will no longer count as outstanding.", danger: true, confirmLabel: "Cancel invoice" })) !== null && patch("cancel")()} className={btn.danger}><Spin k="cancel" icon={Ban} /> Cancel invoice</button>
      )}
      {canEdit && status === "CANCELLED" && (
        <button disabled={busy !== null} onClick={patch("reopen")} className={btn.secondary}><Spin k="reopen" icon={RotateCcw} /> Reopen as draft</button>
      )}
      {canDelete && !hasPayments && (
        <button
          disabled={busy !== null}
          onClick={async () => (await ask({ title: "Delete this invoice permanently?", danger: true, confirmLabel: "Delete" })) !== null && run("delete", () => call(`/api/invoices/${id}`, "DELETE"), "Invoice deleted.", () => { router.push("/invoices"); router.refresh(); })}
          className={btn.danger + " md:ml-auto"}
        >
          <Spin k="delete" icon={Trash2} /> Delete
        </button>
      )}

      {modal === "pay" && <PaymentModal balance={balance} busy={busy === "pay"} onClose={() => setModal(null)} onSave={(body) => run("pay", () => call("/api/payments", "POST", { invoiceId: id, ...body }), "Payment recorded.")} />}
      {modal === "due" && (
        <DueModal value={dueDate} busy={busy === "dueDate"} onClose={() => setModal(null)} onSave={(v) => patch("dueDate", { dueDate: v || null })()} />
      )}
    </div>
  );
}

function PaymentModal({ balance, busy, onClose, onSave }: { balance: number; busy: boolean; onClose: () => void; onSave: (b: object) => void }) {
  const [amount, setAmount] = useState(String(Math.round(balance * 100) / 100));
  const [method, setMethod] = useState("UPI");
  const [ref, setRef] = useState("");
  const today = toLocalInput(new Date()).slice(0, 10);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const n = Number(amount);
  const invalid = !(n > 0) || n > balance + 0.5;

  return (
    <Modal
      open onClose={onClose} title="Record payment"
      footer={
        <button disabled={busy || invalid} onClick={() => onSave({ amount: n, method, referenceNumber: ref, paidAt: date, notes })} className={btn.success + " flex-1 py-3"}>
          {busy && <Loader2 size={15} className="animate-spin" />} Save payment
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Amount received (₹)" hint={`Balance due: ₹${balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}>
          <input type="number" min={0} step="any" autoFocus className={inputCls + " text-[17px] font-semibold"} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Method">
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
          <Field label="Date received"><input type="date" className={inputCls} value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function DueModal({ value, busy, onClose, onSave }: { value: string; busy: boolean; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <Modal open onClose={onClose} title="Change due date" footer={<button disabled={busy} onClick={() => onSave(v)} className={btn.primary + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} Save</button>}>
      <Field label="Due date"><input type="date" className={inputCls} value={v} onChange={(e) => setV(e.target.value)} /></Field>
    </Modal>
  );
}

export function DeletePaymentButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      aria-label="Remove payment"
      disabled={busy}
      onClick={async () => {
        if ((await ask({ title: "Remove this payment?", message: "The invoice balance will be recalculated.", danger: true, confirmLabel: "Remove" })) === null) return;
        setBusy(true);
        try { await call(`/api/payments/${id}`, "DELETE"); toast("Payment removed."); router.refresh(); }
        catch (e: any) { toast(e.message, "error"); }
        finally { setBusy(false); }
      }}
      className="rounded-lg p-2 text-ink-faint hover:bg-danger-bg hover:text-danger"
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
    </button>
  );
}
