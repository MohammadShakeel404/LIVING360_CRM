"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { formatDateTime } from "@/components/ui";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";
import { humanize } from "@/lib/labels";

export type FollowUpRow = {
  id: string; type: string; status: string; scheduledAt: string; notes: string | null; outcome: string | null; by: string;
  lead?: { id: string; name: string };
};

export async function followUpAction(id: string, action: "complete" | "cancel", outcome?: string) {
  const res = await fetch(`/api/followups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, outcome }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't update the follow-up.");
}

export function FollowUpList({ items, canEdit }: { items: FollowUpRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "complete" | "cancel") {
    const answer = await ask(
      action === "complete"
        ? { title: "Mark follow-up done", input: { label: "Outcome (optional)", placeholder: "e.g. Client wants revised kitchen layout" }, confirmLabel: "Mark done" }
        : { title: "Cancel this follow-up?", danger: true, confirmLabel: "Cancel follow-up" }
    );
    if (answer === null) return;
    const outcome = answer || undefined;
    setBusy(id);
    try {
      await followUpAction(id, action, outcome);
      toast(action === "complete" ? "Marked done." : "Follow-up cancelled.");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  if (!items.length) return <div className="rounded-xl2 border border-dashed border-line bg-white p-5 text-center text-[13px] text-ink-soft">No follow-ups logged yet.</div>;

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((f) => {
        const overdue = f.status === "SCHEDULED" && new Date(f.scheduledAt) < new Date();
        const Icon = f.status === "COMPLETED" ? CheckCircle2 : f.status === "CANCELLED" ? XCircle : Clock;
        return (
          <div key={f.id} className={`flex items-start gap-3 rounded-xl2 border bg-white p-3 ${overdue ? "border-danger/25" : "border-line"}`}>
            <div className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] ${f.status === "COMPLETED" ? "bg-success-bg" : overdue ? "bg-danger-bg" : "bg-line-soft"}`}>
              <Icon size={16} className={f.status === "COMPLETED" ? "text-success" : overdue ? "text-danger" : f.status === "CANCELLED" ? "text-ink-faint" : "text-primary"} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <span className={`text-[13.5px] font-semibold ${f.status === "CANCELLED" ? "text-ink-faint line-through" : "text-ink"}`}>
                  {f.lead ? <Link href={`/leads/${f.lead.id}`} className="hover:text-primary">{f.lead.name}</Link> : null}{f.lead ? " · " : ""}{humanize(f.type)}
                </span>
                <span className={`text-xs font-medium ${overdue ? "text-danger" : "text-ink-faint"}`}>{formatDateTime(f.scheduledAt)}</span>
              </div>
              {f.notes && <div className="mt-0.5 text-[12.5px] text-ink-soft">{f.notes}</div>}
              {f.outcome && <div className="mt-0.5 text-[12.5px] font-medium text-success">→ {f.outcome}</div>}
              <div className="mt-1 text-[11.5px] text-ink-faint">by {f.by}</div>
            </div>
            {canEdit && f.status === "SCHEDULED" && (
              <div className="flex flex-shrink-0 gap-1">
                <button aria-label="Mark done" title="Mark done" disabled={busy === f.id} onClick={() => act(f.id, "complete")} className="rounded-lg bg-success-bg p-2 text-success hover:bg-success/15">
                  {busy === f.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                </button>
                <button aria-label="Cancel" title="Cancel" disabled={busy === f.id} onClick={() => act(f.id, "cancel")} className="rounded-lg bg-line-soft p-2 text-ink-soft hover:text-danger">
                  <XCircle size={15} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
