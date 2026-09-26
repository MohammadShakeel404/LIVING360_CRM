"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Check, X, Pencil, Trash2, RotateCcw, Receipt, Loader2 } from "lucide-react";
import { btn } from "@/components/ui";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";

export function CosActions({ id, projectId, status, hasInvoices, canInvoice, clientId }: { id: string; projectId: string; status: string; hasInvoices: boolean; canInvoice: boolean; clientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, init: RequestInit, after?: () => void) {
    setBusy(key);
    try {
      const res = await fetch(`/api/changeorders/${id}`, { headers: { "Content-Type": "application/json" }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      if (data.message) toast(data.message);
      after ? after() : router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }
  const act = (action: string) => run(action, { method: "PATCH", body: JSON.stringify({ action }) });
  const Icon = ({ k, icon: I }: { k: string; icon: any }) => (busy === k ? <Loader2 size={15} className="animate-spin" /> : <I size={15} />);
  const open = status === "DRAFT" || status === "SENT";

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4 empty:hidden">
      {status === "DRAFT" && <Link href={`/projects/${projectId}/cos/${id}/edit`} className={btn.secondary}><Pencil size={15} /> Edit</Link>}
      {status === "DRAFT" && <button disabled={busy !== null} onClick={() => act("send")} className={btn.primary}><Icon k="send" icon={Send} /> Mark as sent</button>}
      {open && (
        <button
          disabled={busy !== null}
          onClick={async () => (await ask({ title: "Client approved this change?", message: "The project value and target date will be updated.", confirmLabel: "Approve" })) !== null && act("approve")}
          className={btn.success}
        >
          <Icon k="approve" icon={Check} /> Client approved
        </button>
      )}
      {open && (
        <button disabled={busy !== null} onClick={async () => (await ask({ title: "Mark as rejected by the client?", danger: true, confirmLabel: "Reject" })) !== null && act("reject")} className={btn.danger}>
          <Icon k="reject" icon={X} /> Rejected
        </button>
      )}
      {status === "REJECTED" && <button disabled={busy !== null} onClick={() => act("reopen")} className={btn.secondary}><Icon k="reopen" icon={RotateCcw} /> Reopen as draft</button>}
      {status === "APPROVED" && canInvoice && <Link href={`/invoices/new?clientId=${clientId}&projectId=${projectId}&changeOrderId=${id}`} className={btn.primary}><Receipt size={15} /> Create invoice</Link>}
      {status !== "APPROVED" && !hasInvoices && (
        <button
          disabled={busy !== null}
          onClick={async () => (await ask({ title: "Delete this change of scope?", danger: true, confirmLabel: "Delete" })) !== null && run("delete", { method: "DELETE" }, () => { toast("Deleted."); router.push(`/projects/${projectId}`); router.refresh(); })}
          className={btn.danger + " md:ml-auto"}
        >
          <Icon k="delete" icon={Trash2} /> Delete
        </button>
      )}
    </div>
  );
}
