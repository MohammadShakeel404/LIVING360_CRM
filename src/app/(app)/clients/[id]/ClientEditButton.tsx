"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import { Field, inputCls, btn } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";

type C = { id: string; name: string; phone: string; email: string | null; address: string | null; gstin: string | null };

export function ClientEditButton({ client }: { client: C }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: client.name, phone: client.phone, email: client.email ?? "", address: client.address ?? "", gstin: client.gstin ?? "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      toast("Client updated.");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btn.secondary}><Pencil size={15} /> Edit details</button>
      <Modal
        open={open} onClose={() => setOpen(false)} title="Edit client"
        footer={<button disabled={busy || !f.name.trim() || f.phone.trim().length < 6} onClick={save} className={btn.primary + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} Save</button>}
      >
        <div className="flex flex-col gap-3">
          <Field label="Name *"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone *"><input className={inputCls} value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
            <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={set("email")} /></Field>
          </div>
          <Field label="Billing address" hint="Printed on quotations and invoices."><textarea rows={3} className={inputCls + " resize-none"} value={f.address} onChange={set("address")} /></Field>
          <Field label="GSTIN (for business clients)"><input className={inputCls + " uppercase"} maxLength={15} value={f.gstin} onChange={set("gstin")} /></Field>
        </div>
      </Modal>
    </>
  );
}
