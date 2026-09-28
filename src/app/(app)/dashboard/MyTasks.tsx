"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { PriorityChip, formatDate } from "@/components/ui";
import { toast } from "@/components/toast";

type T = { id: string; title: string; priority: string; dueDate: string | null; projectId: string | null; projectNumber: string | null };

export function MyTasks({ tasks, canEdit }: { tasks: T[]; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  async function complete(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "COMPLETED" }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't complete the task.");
      setDone((s) => new Set(s).add(id));
      toast("Task completed.");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {tasks.filter((t) => !done.has(t.id)).map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-xl2 border border-line bg-white p-3">
          {canEdit && (
            <button aria-label="Mark complete" title="Mark complete" disabled={busy === t.id} onClick={() => complete(t.id)} className="-m-2 flex-shrink-0 p-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-ink-faint/60 hover:border-primary hover:bg-primary/5">
                {busy === t.id ? <Loader2 size={12} className="animate-spin text-primary" /> : <Check size={13} className="text-transparent hover:text-primary" />}
              </span>
            </button>
          )}
          <Link href={t.projectId ? `/projects/${t.projectId}` : "/tasks"} className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-ink">{t.title}</div>
            <div className="flex items-center gap-1 text-xs text-ink-soft"><CalendarDays size={11} /> {t.dueDate ? formatDate(t.dueDate) : "No due date"}{t.projectNumber ? ` · ${t.projectNumber}` : ""}</div>
          </Link>
          <PriorityChip priority={t.priority} />
        </div>
      ))}
    </div>
  );
}
