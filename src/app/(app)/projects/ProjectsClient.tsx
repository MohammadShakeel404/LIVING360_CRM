"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Building2, MapPin, User, Loader2 } from "lucide-react";
import { EmptyState, Field, PageHeader, StatusChip, inputCls, btn, formatCurrency, formatDate } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { PROJECT_STAGES, humanize } from "@/lib/labels";

type P = {
  id: string; projectNumber: string; clientName: string; manager: string | null; siteLocation: string | null; stage: string;
  expectedCompletion: string | null; value: number | null; tasksOpen: number; tasksTotal: number;
};

export function ProjectsClient({
  projects, clients, managers, canCreate, financial, openNew, defaultClientId,
}: {
  projects: P[]; clients: { id: string; name: string; clientNumber: string }[]; managers: { id: string; name: string }[];
  canCreate: boolean; financial: boolean; openNew: boolean; defaultClientId: string;
}) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("ACTIVE");
  const [creating, setCreating] = useState(openNew && canCreate);
  const filtered = useMemo(() => {
    const n = q.toLowerCase();
    return projects.filter((p) =>
      (stage === "ALL" || (stage === "ACTIVE" ? p.stage !== "COMPLETED" : p.stage === stage)) &&
      (!n || p.projectNumber.toLowerCase().includes(n) || p.clientName.toLowerCase().includes(n))
    );
  }, [projects, q, stage]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Projects"
        subtitle={`${projects.filter((p) => p.stage !== "COMPLETED").length} active · ${projects.filter((p) => p.stage === "COMPLETED").length} completed`}
        actions={canCreate ? <button onClick={() => setCreating(true)} className={btn.primary}><Plus size={15} /> New project</button> : undefined}
      />
      <div className="flex flex-col gap-2.5 md:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2.5 focus-within:border-primary/50">
          <Search size={16} className="text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by project or client…" className="flex-1 bg-transparent text-[14px] outline-none" />
        </div>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="rounded-xl2 border border-line bg-white px-3 py-2.5 text-[14px] outline-none">
          <option value="ACTIVE">Active projects</option>
          <option value="ALL">All projects</option>
          {PROJECT_STAGES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl2 border border-line bg-white"><EmptyState icon={Building2} title={projects.length ? "No matches" : "No projects yet"} note={projects.length ? "Try another filter." : "Start a project once a client accepts a quotation."} /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const idx = PROJECT_STAGES.indexOf(p.stage as any);
            const pct = Math.round(((idx + 1) / PROJECT_STAGES.length) * 100);
            const late = p.expectedCompletion && new Date(p.expectedCompletion) < new Date() && p.stage !== "COMPLETED";
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-xl2 border border-line bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(37,26,81,0.07)]">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-ink">{p.clientName}</div>
                    <div className="text-[12px] text-ink-soft">{p.projectNumber}</div>
                  </div>
                  <StatusChip status={p.stage} />
                </div>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-line-soft">
                  <div className={`h-full rounded-full ${p.stage === "COMPLETED" ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-col gap-1 text-[12.5px] text-ink-soft">
                  <span className="flex items-center gap-1.5"><User size={12} /> {p.manager ?? "No PM assigned"}</span>
                  <span className="flex items-center gap-1.5 truncate"><MapPin size={12} /> {p.siteLocation ?? "—"}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-2.5 text-[12px]">
                  <span className={late ? "font-semibold text-danger" : "text-ink-faint"}>{p.expectedCompletion ? `${late ? "Overdue · " : "Due "}${formatDate(p.expectedCompletion)}` : "No target date"}</span>
                  <span className="text-ink-soft">{p.tasksOpen}/{p.tasksTotal} tasks open{financial && p.value ? ` · ${formatCurrency(p.value)}` : ""}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {creating && <NewProjectModal clients={clients} managers={managers} defaultClientId={defaultClientId} financial={financial} onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewProjectModal({ clients, managers, defaultClientId, financial, onClose }: { clients: { id: string; name: string; clientNumber: string }[]; managers: { id: string; name: string }[]; defaultClientId: string; financial: boolean; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ clientId: defaultClientId, projectManagerId: "", siteLocation: "", startDate: new Date().toISOString().slice(0, 10), expectedCompletion: "", budget: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, projectManagerId: f.projectManagerId || null, expectedCompletion: f.expectedCompletion || null, budget: f.budget ? Number(f.budget) : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create the project.");
      toast(`Project ${data.project.projectNumber} created.`);
      router.push(`/projects/${data.project.id}`);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New project" footer={<button disabled={busy || !f.clientId} onClick={save} className={btn.primary + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} Create project</button>}>
      <div className="flex flex-col gap-3">
        <Field label="Client *">
          <select className={inputCls} value={f.clientId} onChange={set("clientId")}>
            <option value="">— Select client —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.clientNumber})</option>)}
          </select>
        </Field>
        <Field label="Project manager">
          <select className={inputCls} value={f.projectManagerId} onChange={set("projectManagerId")}>
            <option value="">— Assign later —</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Site location" hint="Defaults to the client's address."><input className={inputCls} value={f.siteLocation} onChange={set("siteLocation")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date"><input type="date" className={inputCls} value={f.startDate} onChange={set("startDate")} /></Field>
          <Field label="Target completion"><input type="date" className={inputCls} value={f.expectedCompletion} onChange={set("expectedCompletion")} /></Field>
        </div>
        {financial && <Field label="Execution budget (₹)" hint="Contract value is taken from the accepted quotation."><input type="number" min={0} className={inputCls} value={f.budget} onChange={set("budget")} /></Field>}
      </div>
    </Modal>
  );
}
