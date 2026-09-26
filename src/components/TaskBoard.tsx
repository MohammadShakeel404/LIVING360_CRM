"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Check, ListChecks, Trash2, CalendarDays } from "lucide-react";
import { Avatar, EmptyState, Field, PriorityChip, inputCls, btn, formatDate } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";
import { humanize } from "@/lib/labels";

export type TaskRow = {
  id: string; title: string; description: string | null; status: string; priority: string; dueDate: string | null;
  projectId: string | null; projectNumber: string | null; assigneeId: string | null; assigneeName: string | null;
};
type Opt = { id: string; label: string };

const STATUSES = ["TODO", "IN_PROGRESS", "WAITING", "COMPLETED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

async function call(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export function TaskBoard({
  tasks, users, projects, canCreate, canEdit, canDelete, projectId,
}: {
  tasks: TaskRow[]; users: Opt[]; projects: Opt[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; projectId?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"open" | "done">("open");
  const [editing, setEditing] = useState<TaskRow | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const shown = useMemo(() => tasks.filter((t) => (tab === "done" ? t.status === "COMPLETED" : t.status !== "COMPLETED")), [tasks, tab]);

  async function setStatus(t: TaskRow, status: string) {
    setBusy(t.id);
    try {
      await call(`/api/tasks/${t.id}`, "PATCH", { status });
      toast(status === "COMPLETED" ? "Task completed." : `Moved to ${humanize(status)}.`);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-[10px] bg-line-soft p-1">
          {([["open", "Open"], ["done", "Completed"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${tab === id ? "bg-white text-primary shadow-sm" : "text-ink-soft"}`}>
              {label} <span className="opacity-60">{tasks.filter((t) => (id === "done") === (t.status === "COMPLETED")).length}</span>
            </button>
          ))}
        </div>
        {canCreate && <button onClick={() => setEditing("new")} className={btn.primary}><Plus size={15} /> New task</button>}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl2 border border-line bg-white"><EmptyState icon={ListChecks} title={tab === "done" ? "Nothing completed yet" : "All clear"} note={tab === "done" ? "Completed tasks show up here." : "No open tasks right now."} /></div>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((t) => {
            const overdue = t.dueDate && new Date(t.dueDate) < today && t.status !== "COMPLETED";
            return (
              <div key={t.id} className={`flex items-start gap-3 rounded-xl2 border bg-white p-3 ${overdue ? "border-danger/25" : "border-line"}`}>
                <button
                  aria-label={t.status === "COMPLETED" ? "Reopen task" : "Complete task"}
                  disabled={!canEdit || busy === t.id}
                  onClick={() => setStatus(t, t.status === "COMPLETED" ? "TODO" : "COMPLETED")}
                  title={t.status === "COMPLETED" ? "Reopen task" : "Mark complete"}
                  className="-m-2 flex-shrink-0 p-2 disabled:cursor-not-allowed"
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors ${t.status === "COMPLETED" ? "border-success bg-success text-white" : "border-ink-faint/60 hover:border-primary hover:bg-primary/5"}`}>
                    {busy === t.id ? <Loader2 size={12} className="animate-spin text-primary" /> : t.status === "COMPLETED" ? <Check size={14} strokeWidth={3} /> : null}
                  </span>
                </button>
                <button onClick={() => canEdit && setEditing(t)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[14px] font-semibold ${t.status === "COMPLETED" ? "text-ink-faint line-through" : "text-ink"}`}>{t.title}</span>
                    <PriorityChip priority={t.priority} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-soft">
                    {!projectId && (t.projectNumber ? <span className="font-medium text-primary">{t.projectNumber}</span> : <span>No project</span>)}
                    <span className="flex items-center gap-1">{t.assigneeName && <Avatar name={t.assigneeName} size={16} />} {t.assigneeName ?? "Unassigned"}</span>
                    <span className={`flex items-center gap-1 ${overdue ? "font-semibold text-danger" : ""}`}><CalendarDays size={12} /> {t.dueDate ? formatDate(t.dueDate) : "No due date"}</span>
                    {t.status !== "COMPLETED" && t.status !== "TODO" && <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-semibold">{humanize(t.status)}</span>}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <TaskModal
          task={editing === "new" ? null : editing}
          users={users}
          projects={projects}
          projectId={projectId}
          canDelete={canDelete}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function TaskModal({ task, users, projects, projectId, canDelete, onClose, onSaved }: { task: TaskRow | null; users: Opt[]; projects: Opt[]; projectId?: string; canDelete: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: task?.title ?? "", description: task?.description ?? "", projectId: task?.projectId ?? projectId ?? "",
    assigneeId: task?.assigneeId ?? "", priority: task?.priority ?? "MEDIUM", status: task?.status ?? "TODO",
    dueDate: task?.dueDate?.slice(0, 10) ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save(del = false) {
    setBusy(true);
    try {
      if (del) {
        if ((await ask({ title: "Delete this task?", danger: true, confirmLabel: "Delete" })) === null) return setBusy(false);
        await call(`/api/tasks/${task!.id}`, "DELETE");
      } else {
        await call(task ? `/api/tasks/${task.id}` : "/api/tasks", task ? "PATCH" : "POST", {
          ...f, projectId: f.projectId || null, assigneeId: f.assigneeId || null, dueDate: f.dueDate || null,
        });
      }
      toast(del ? "Task deleted." : task ? "Task updated." : "Task created.");
      onSaved();
    } catch (e: any) {
      toast(e.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal
      open onClose={onClose} title={task ? "Edit task" : "New task"}
      footer={
        <>
          {task && canDelete && <button disabled={busy} onClick={() => save(true)} className={btn.danger}><Trash2 size={15} /></button>}
          <button disabled={busy || !f.title.trim()} onClick={() => save()} className={btn.primary + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} {task ? "Save" : "Create task"}</button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Title *"><input autoFocus className={inputCls} value={f.title} onChange={set("title")} placeholder="e.g. Finalise kitchen BOQ" /></Field>
        <Field label="Details"><textarea rows={2} className={inputCls + " resize-none"} value={f.description} onChange={set("description")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          {!projectId && (
            <Field label="Project">
              <select className={inputCls} value={f.projectId} onChange={set("projectId")}><option value="">— None —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            </Field>
          )}
          <Field label="Assign to">
            <select className={inputCls} value={f.assigneeId} onChange={set("assigneeId")}><option value="">Me</option>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select>
          </Field>
          <Field label="Priority">
            <select className={inputCls} value={f.priority} onChange={set("priority")}>{PRIORITIES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}</select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={f.status} onChange={set("status")}>{STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select>
          </Field>
          <Field label="Due date"><input type="date" className={inputCls} value={f.dueDate} onChange={set("dueDate")} /></Field>
        </div>
        {task?.projectId && !projectId && <Link href={`/projects/${task.projectId}`} className="text-[12.5px] font-semibold text-primary">Open project →</Link>}
      </div>
    </Modal>
  );
}
