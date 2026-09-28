"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IndianRupee, Pencil, CheckCircle2, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { btn } from "@/components/ui";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";
import { PaymentForm, type StageBalance } from "@/components/workers/PaymentForm";
import { AssignmentForm, type AssignmentFormValue, type WorkerOption } from "@/components/workers/AssignmentForm";

export function AssignmentActions({
  assignmentId, projectId, workerName, status, balance, stages, hasPayments, canPay, canEdit, workers, form,
}: {
  assignmentId: string; projectId: string; workerName: string; status: string; balance: number; stages: StageBalance[];
  hasPayments: boolean; canPay: boolean; canEdit: boolean; workers: WorkerOption[]; form: AssignmentFormValue;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"pay" | "edit" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function call(key: string, init: RequestInit, after?: () => void) {
    setBusy(key);
    try {
      const res = await fetch(`/api/workers/assignments/${assignmentId}`, { headers: { "Content-Type": "application/json" }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      toast(data.message ?? "Done.");
      after ? after() : router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 empty:hidden">
      {canPay && <button onClick={() => setModal("pay")} className={btn.success}><IndianRupee size={15} /> Record payment</button>}
      {canEdit && <button onClick={() => setModal("edit")} className={btn.secondary}><Pencil size={15} /> Edit work & pay</button>}
      {canEdit && status === "ACTIVE" && (
        <button disabled={busy !== null} onClick={() => call("complete", { method: "PATCH", body: JSON.stringify({ action: "complete" }) })} className={btn.secondary}>
          {busy === "complete" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Mark work completed
        </button>
      )}
      {canEdit && status === "COMPLETED" && (
        <button disabled={busy !== null} onClick={() => call("reopen", { method: "PATCH", body: JSON.stringify({ action: "reopen" }) })} className={btn.secondary}>
          {busy === "reopen" ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} Reopen
        </button>
      )}
      {canEdit && !hasPayments && (
        <button
          disabled={busy !== null}
          onClick={async () => (await ask({ title: `Remove ${workerName} from this project?`, danger: true, confirmLabel: "Remove" })) !== null && call("delete", { method: "DELETE" }, () => { router.push(`/projects/${projectId}`); router.refresh(); })}
          className={btn.danger + " md:ml-auto"}
        >
          {busy === "delete" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Remove from project
        </button>
      )}

      {modal === "pay" && <PaymentForm assignmentId={assignmentId} workerName={workerName} balance={balance} stages={stages} onClose={() => setModal(null)} />}
      {modal === "edit" && <AssignmentForm initial={form} workers={workers} onClose={() => setModal(null)} />}
    </div>
  );
}
