"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Briefcase, FileText, UserX, UserCheck, Trash2, Loader2 } from "lucide-react";
import { toLocalInput } from "@/lib/labels";
import { btn } from "@/components/ui";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";
import { WorkerForm, type WorkerFormValue } from "@/components/workers/WorkerForm";
import { AssignmentForm, type WorkerOption } from "@/components/workers/AssignmentForm";

export function WorkerActions({
  worker, status, hasHistory, canEdit, canDelete, canAssign, financial, workers, projects,
}: {
  worker: WorkerFormValue & { id: string };
  status: string; hasHistory: boolean; canEdit: boolean; canDelete: boolean; canAssign: boolean; financial: boolean;
  workers: WorkerOption[]; projects: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"edit" | "assign" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function call(key: string, init: RequestInit, after?: () => void) {
    setBusy(key);
    try {
      const res = await fetch(`/api/workers/${worker.id}`, { headers: { "Content-Type": "application/json" }, ...init });
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
    <div className="flex flex-wrap gap-2">
      {canAssign && <button onClick={() => setModal("assign")} className={btn.primary}><Briefcase size={15} /> Assign to project</button>}
      {canEdit && <button onClick={() => setModal("edit")} className={btn.secondary}><Pencil size={15} /> Edit details</button>}
      {financial && hasHistory && <a href={`/api/workers/${worker.id}/statement`} className={btn.secondary}><FileText size={15} /> Statement PDF</a>}
      {canEdit && status === "ACTIVE" && (
        <button
          disabled={busy !== null}
          onClick={async () => (await ask({ title: `Mark ${worker.name} inactive?`, message: "They won't appear when assigning work. History and payments are kept.", confirmLabel: "Mark inactive" })) !== null && call("status", { method: "PATCH", body: JSON.stringify({ status: "INACTIVE" }) })}
          className={btn.secondary}
        >
          {busy === "status" ? <Loader2 size={15} className="animate-spin" /> : <UserX size={15} />} Mark inactive
        </button>
      )}
      {canEdit && status === "INACTIVE" && (
        <button disabled={busy !== null} onClick={() => call("status", { method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }) })} className={btn.secondary}>
          {busy === "status" ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />} Reactivate
        </button>
      )}
      {canDelete && !hasHistory && (
        <button
          disabled={busy !== null}
          onClick={async () => (await ask({ title: `Delete ${worker.name}?`, danger: true, confirmLabel: "Delete" })) !== null && call("delete", { method: "DELETE" }, () => { router.push("/workers"); router.refresh(); })}
          className={btn.danger + " md:ml-auto"}
        >
          {busy === "delete" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete
        </button>
      )}

      {modal === "edit" && <WorkerForm initial={worker} onClose={() => setModal(null)} />}
      {modal === "assign" && (
        <AssignmentForm
          workers={workers}
          projects={projects}
          onClose={() => setModal(null)}
          initial={{
            workerId: worker.id, projectId: projects[0]?.id ?? "", scope: "", rateType: worker.defaultRateType || "LUMP_SUM",
            rate: worker.defaultRate, quantity: "", unit: worker.defaultRateType === "PER_UNIT" ? "sq.ft" : "days",
            agreedAmount: "", startDate: toLocalInput(new Date()).slice(0, 10), endDate: "", notes: "", stages: [],
          }}
        />
      )}
    </div>
  );
}
