"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Field, inputCls, btn } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { TRADES, RATE_TYPE_LABEL } from "@/lib/workers";

export type WorkerFormValue = {
  id?: string; name: string; trade: string; phone: string; altPhone: string; address: string; idProof: string;
  bankName: string; accountName: string; accountNumber: string; ifsc: string; upiId: string;
  defaultRate: string; defaultRateType: string; notes: string;
};

export const emptyWorker = (): WorkerFormValue => ({
  name: "", trade: TRADES[0], phone: "", altPhone: "", address: "", idProof: "", bankName: "", accountName: "",
  accountNumber: "", ifsc: "", upiId: "", defaultRate: "", defaultRateType: "DAILY", notes: "",
});

/** Add / edit a worker's profile, contact and payment details. */
export function WorkerForm({ initial, onClose, onSaved }: { initial: WorkerFormValue; onClose: () => void; onSaved?: (id: string) => void }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const editing = !!initial.id;
  const set = (k: keyof WorkerFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const phoneOk = f.phone.replace(/\D/g, "").length >= 10;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(editing ? `/api/workers/${initial.id}` : "/api/workers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f, id: undefined,
          defaultRate: f.defaultRate ? Number(f.defaultRate) : null,
          defaultRateType: f.defaultRate ? f.defaultRateType : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the worker.");
      toast(editing ? "Worker updated." : `${data.worker.name} added as ${data.worker.workerNumber}.`);
      onClose();
      onSaved ? onSaved(editing ? initial.id! : data.worker.id) : router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal
      open wide onClose={onClose} title={editing ? "Edit worker" : "Add worker"}
      footer={<button disabled={busy || !f.name.trim() || !phoneOk} onClick={save} className={btn.primary + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} {editing ? "Save changes" : "Add worker"}</button>}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Full name *"><input autoFocus className={inputCls} value={f.name} onChange={set("name")} placeholder="e.g. Ramesh Kumar" /></Field>
          <Field label="Trade *">
            <select className={inputCls} value={f.trade} onChange={set("trade")}>
              {[...new Set([...TRADES, f.trade])].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Mobile *" hint={f.phone && !phoneOk ? "Enter a 10-digit number" : undefined}><input className={inputCls} value={f.phone} onChange={set("phone")} inputMode="tel" placeholder="98xxxxxxxx" /></Field>
          <Field label="Alternate mobile"><input className={inputCls} value={f.altPhone} onChange={set("altPhone")} inputMode="tel" /></Field>
          <Field label="Address" className="md:col-span-2"><input className={inputCls} value={f.address} onChange={set("address")} /></Field>
          <Field label="ID proof" hint="e.g. Aadhaar XXXX-1234"><input className={inputCls} value={f.idProof} onChange={set("idProof")} /></Field>
          <div className="grid grid-cols-[1fr_1.2fr] gap-2">
            <Field label="Usual rate (₹)"><input type="number" min={0} className={inputCls} value={f.defaultRate} onChange={set("defaultRate")} /></Field>
            <Field label="Rate type">
              <select className={inputCls} value={f.defaultRateType} onChange={set("defaultRateType")}>
                {Object.entries(RATE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-semibold text-ink">Payment details <span className="font-normal text-ink-faint">(optional — shown on receipts)</span></div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="UPI ID"><input className={inputCls} value={f.upiId} onChange={set("upiId")} placeholder="name@okbank" /></Field>
            <Field label="Bank name"><input className={inputCls} value={f.bankName} onChange={set("bankName")} /></Field>
            <Field label="Account holder"><input className={inputCls} value={f.accountName} onChange={set("accountName")} /></Field>
            <Field label="Account number"><input className={inputCls} value={f.accountNumber} onChange={set("accountNumber")} inputMode="numeric" /></Field>
            <Field label="IFSC"><input className={inputCls + " uppercase"} value={f.ifsc} onChange={set("ifsc")} /></Field>
          </div>
        </div>
        <Field label="Notes"><textarea rows={2} className={inputCls + " resize-none"} value={f.notes} onChange={set("notes")} placeholder="Skills, reliability, team size…" /></Field>
      </div>
    </Modal>
  );
}
