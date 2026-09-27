"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, HardHat, Phone } from "lucide-react";
import { Avatar, EmptyState, MiniStat, PageHeader, btn, formatCurrency } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
import { WorkerForm, emptyWorker } from "@/components/workers/WorkerForm";

type W = {
  id: string; workerNumber: string; name: string; trade: string; phone: string; status: string;
  activeProjects: string[]; projects: number; payable: number | null; paid: number | null; balance: number | null;
};

export function WorkersClient({ workers, financial, canCreate, canExport }: { workers: W[]; financial: boolean; canCreate: boolean; canExport: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [trade, setTrade] = useState("ALL");
  const [show, setShow] = useState<"ACTIVE" | "DUE" | "ALL">("ACTIVE");
  const [adding, setAdding] = useState(false);
  const trades = [...new Set(workers.map((w) => w.trade))].sort();

  const filtered = useMemo(() => {
    const n = q.toLowerCase();
    return workers.filter((w) =>
      (trade === "ALL" || w.trade === trade) &&
      (show === "ALL" || (show === "ACTIVE" ? w.status === "ACTIVE" : (w.balance ?? 0) > 0.5)) &&
      (!n || w.name.toLowerCase().includes(n) || w.phone.includes(n) || w.workerNumber.toLowerCase().includes(n) || w.trade.toLowerCase().includes(n))
    );
  }, [workers, q, trade, show]);

  const totals = workers.reduce((t, w) => ({ payable: t.payable + (w.payable ?? 0), paid: t.paid + (w.paid ?? 0), balance: t.balance + (w.balance ?? 0) }), { payable: 0, paid: 0, balance: 0 });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Workers"
        subtitle="Carpenters, POP, painters, electricians and labour — their projects and payments."
        actions={
          <>
            {canExport && <ExportButton endpoint="/api/workers/export" label="Export" />}
            {canCreate && <button onClick={() => setAdding(true)} className={btn.primary}><Plus size={15} /> Add worker</button>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Active workers" value={String(workers.filter((w) => w.status === "ACTIVE").length)} sub={`${workers.filter((w) => w.activeProjects.length).length} on a project now`} />
        {financial && <MiniStat label="Total payable" value={formatCurrency(totals.payable)} sub="All assigned work" />}
        {financial && <MiniStat label="Paid" value={formatCurrency(totals.paid)} tone="text-success" />}
        {financial && <MiniStat label="Still to pay" value={formatCurrency(totals.balance)} tone={totals.balance > 0.5 ? "text-warning" : undefined} sub={`${workers.filter((w) => (w.balance ?? 0) > 0.5).length} workers`} />}
      </div>

      <div className="flex flex-col gap-2.5 md:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2.5 focus-within:border-primary/50">
          <Search size={16} className="text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, trade or ID…" className="flex-1 bg-transparent text-[14px] outline-none" />
        </div>
        <div className="flex gap-2">
          <select value={trade} onChange={(e) => setTrade(e.target.value)} className="flex-1 rounded-xl2 border border-line bg-white px-3 py-2.5 text-[14px] outline-none md:flex-none">
            <option value="ALL">All trades</option>
            {trades.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} className="flex-1 rounded-xl2 border border-line bg-white px-3 py-2.5 text-[14px] outline-none md:flex-none">
            <option value="ACTIVE">Active</option>
            {financial && <option value="DUE">Payment due</option>}
            <option value="ALL">All (incl. inactive)</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl2 border border-line bg-white">
          <EmptyState icon={HardHat} title={workers.length ? "No matching workers" : "No workers yet"} note={workers.length ? "Try another search or filter." : "Add your carpenters, POP team, painters and labour to track their work and payments."} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((w) => {
            const pct = w.payable ? Math.min(100, ((w.paid ?? 0) / w.payable) * 100) : 0;
            return (
              <Link key={w.id} href={`/workers/${w.id}`} className={`block rounded-xl2 border border-line bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(37,26,81,0.07)] ${w.status === "INACTIVE" ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={w.name} size={42} tone="bg-dark" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[15px] font-semibold text-ink">{w.name}</span>
                      {w.status === "INACTIVE" && <span className="rounded-full bg-line-soft px-2 py-0.5 text-[10.5px] font-bold text-ink-faint">INACTIVE</span>}
                    </div>
                    <div className="text-[12.5px] font-medium text-primary">{w.trade}</div>
                    <div className="flex items-center gap-1 text-[12px] text-ink-soft"><Phone size={11} /> {w.phone} · {w.workerNumber}</div>
                  </div>
                </div>
                <div className="mt-3 text-[12px] text-ink-soft">
                  {w.activeProjects.length ? <>On <b className="text-ink">{w.activeProjects.join(", ")}</b></> : w.projects ? `${w.projects} past project${w.projects > 1 ? "s" : ""}` : "Not assigned yet"}
                </div>
                {financial && w.payable ? (
                  <div className="mt-2.5 border-t border-line-soft pt-2.5">
                    <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-ink-soft">Paid {formatCurrency(w.paid)} of {formatCurrency(w.payable)}</span>
                      <span className={(w.balance ?? 0) > 0.5 ? "font-semibold text-warning" : "font-semibold text-success"}>{(w.balance ?? 0) > 0.5 ? `${formatCurrency(w.balance)} due` : "Settled"}</span>
                    </div>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}

      {adding && <WorkerForm initial={emptyWorker()} onClose={() => setAdding(false)} onSaved={(id) => router.push(`/workers/${id}`)} />}
    </div>
  );
}
