"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Receipt } from "lucide-react";
import { EmptyState, PageHeader, StatusChip, formatCurrency, formatDate, btn, MiniStat } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
import { humanize } from "@/lib/labels";

type Row = {
  id: string; invoiceNumber: string; clientName: string; quotationNumber: string | null; type: string; status: string;
  invoiceDate: string; dueDate: string | null; total: number | null; balance: number | null;
};

const TABS = [["ALL", "All"], ["DRAFT", "Draft"], ["UNPAID", "Unpaid"], ["OVERDUE", "Overdue"], ["PAID", "Paid"], ["CANCELLED", "Cancelled"]] as const;
const UNPAID = ["SENT", "PARTIALLY_PAID", "OVERDUE"];
const match = (tab: string, s: string) => tab === "ALL" || (tab === "UNPAID" ? UNPAID.includes(s) : s === tab);

export function InvoicesClient({
  rows, initialTab, collectedThisMonth, canCreate, canExport, financial,
}: { rows: Row[]; initialTab: string; collectedThisMonth: number | null; canCreate: boolean; canExport: boolean; financial: boolean }) {
  const [tab, setTab] = useState<string>(TABS.some(([id]) => id === initialTab) ? initialTab : "ALL");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const n = q.toLowerCase();
    return rows.filter((r) => match(tab, r.status) && (!n || r.invoiceNumber.toLowerCase().includes(n) || r.clientName.toLowerCase().includes(n)));
  }, [rows, tab, q]);

  const outstanding = rows.filter((r) => UNPAID.includes(r.status)).reduce((s, r) => s + (r.balance ?? 0), 0);
  const overdue = rows.filter((r) => r.status === "OVERDUE");
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (["DRAFT", "PAID", "CANCELLED"].includes(tab)) exportParams.set("status", tab);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Invoices"
        subtitle={`${rows.length} invoice${rows.length === 1 ? "" : "s"}`}
        actions={
          <>
            {canExport && <ExportButton endpoint={`/api/invoices/export${exportParams.toString() ? "?" + exportParams : ""}`} label="Export" />}
            {canCreate && <Link href="/invoices/new" className={btn.primary}><Plus size={15} /> New invoice</Link>}
          </>
        }
      />

      {financial && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MiniStat label="Outstanding" value={formatCurrency(outstanding)} sub={`${rows.filter((r) => UNPAID.includes(r.status)).length} unpaid invoices`} />
          <MiniStat label="Overdue" value={formatCurrency(overdue.reduce((s, r) => s + (r.balance ?? 0), 0))} sub={`${overdue.length} past due date`} tone={overdue.length ? "text-danger" : undefined} />
          <MiniStat label="Collected this month" value={formatCurrency(collectedThisMonth ?? 0)} sub="Payments received" tone="text-success" />
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2.5 focus-within:border-primary/50">
        <Search size={16} className="text-ink-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by invoice number or client…" className="flex-1 bg-transparent text-[14px] outline-none" />
      </div>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max gap-1 rounded-[10px] bg-line-soft p-1">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${tab === id ? `bg-white shadow-sm ${id === "OVERDUE" ? "text-danger" : "text-primary"}` : "text-ink-soft"}`}>
              {label} <span className="opacity-60">{rows.filter((r) => match(id, r.status)).length}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl2 border border-line bg-white">
          <EmptyState icon={Receipt} title={rows.length ? "No matches" : "No invoices yet"} note={rows.length ? "Try another tab or search." : "Create an invoice from an accepted quotation, or start a blank one."} />
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl2 border border-line bg-white md:block">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line bg-appbg text-left text-[12px] font-semibold text-ink-soft">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due</th>
                  {financial && <th className="px-4 py-3 text-right">Total</th>}
                  {financial && <th className="px-4 py-3 text-right">Balance</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-appbg/70">
                    <td className="px-4 py-3">
                      <Link href={`/invoices/${r.id}`} className="font-semibold text-primary hover:underline">{r.invoiceNumber}</Link>
                      <div className="text-[12px] text-ink-faint">{formatDate(r.invoiceDate)} · {humanize(r.type)}{r.quotationNumber ? ` · ${r.quotationNumber}` : ""}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{r.clientName}</td>
                    <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                    <td className={`px-4 py-3 ${r.status === "OVERDUE" ? "font-medium text-danger" : "text-ink-soft"}`}>{formatDate(r.dueDate)}</td>
                    {financial && <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.total)}</td>}
                    {financial && <td className={`px-4 py-3 text-right font-semibold ${r.balance ? "text-ink" : "text-success"}`}>{r.balance ? formatCurrency(r.balance) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">
            {filtered.map((r) => (
              <Link key={r.id} href={`/invoices/${r.id}`} className="block rounded-xl2 border border-line bg-white p-3.5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-semibold text-ink">{r.clientName}</div>
                    <div className="text-xs text-ink-soft">{r.invoiceNumber} · {humanize(r.type)}</div>
                  </div>
                  <StatusChip status={r.status} />
                </div>
                <div className="flex items-center justify-between border-t border-line-soft pt-2.5 text-xs text-ink-soft">
                  <span className={r.status === "OVERDUE" ? "font-medium text-danger" : ""}>Due {formatDate(r.dueDate)}</span>
                  {financial && <span className="text-[13.5px] font-bold text-ink">{r.balance ? `${formatCurrency(r.balance)} due` : formatCurrency(r.total)}</span>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

