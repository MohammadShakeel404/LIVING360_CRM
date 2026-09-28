"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, AlertTriangle, FileText } from "lucide-react";
import { StatusChip, EmptyState, PageHeader, formatCurrency, formatDate, btn, MiniStat } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";

const TABS = [
  ["ALL", "All"], ["APPROVAL", "Needs approval"], ["DRAFT", "Draft"], ["SENT", "Sent"],
  ["APPROVED", "Accepted"], ["REJECTED", "Rejected"], ["EXPIRED", "Expired"],
] as const;

export type QuotationListItem = {
  id: string;
  quotationNumber: string;
  version: number;
  status: string;
  requiresApproval: boolean;
  clientName: string;
  salesperson: string;
  itemCount: number;
  total: number | null;
  validUntil: string | null;
  createdAt: string;
};

const statusLabel = (s: string) => (s === "APPROVED" ? "Accepted" : undefined);

export function QuotationsClient({
  initialQuotations, initialTab, canExport, canCreate, financialAccess,
}: {
  initialQuotations: QuotationListItem[];
  initialTab: string;
  canExport: boolean;
  canCreate: boolean;
  financialAccess: boolean;
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(TABS.some(([id]) => id === initialTab) ? initialTab : "ALL");

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return initialQuotations.filter((qt) => {
      const matchQ = !needle || qt.quotationNumber.toLowerCase().includes(needle) || qt.clientName.toLowerCase().includes(needle);
      const matchTab = tab === "ALL" || (tab === "APPROVAL" ? qt.requiresApproval && qt.status === "DRAFT" : qt.status === tab);
      return matchQ && matchTab;
    });
  }, [initialQuotations, q, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: initialQuotations.length, APPROVAL: 0 };
    for (const x of initialQuotations) {
      c[x.status] = (c[x.status] ?? 0) + 1;
      if (x.requiresApproval && x.status === "DRAFT") c.APPROVAL++;
    }
    return c;
  }, [initialQuotations]);

  const pipelineValue = initialQuotations.filter((x) => x.status === "SENT" || x.status === "VIEWED").reduce((s, x) => s + (x.total ?? 0), 0);
  const wonValue = initialQuotations.filter((x) => x.status === "APPROVED").reduce((s, x) => s + (x.total ?? 0), 0);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tab !== "ALL" && tab !== "APPROVAL") params.set("status", tab);
  const exportUrl = `/api/quotations/export${params.toString() ? "?" + params : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Quotations"
        subtitle={`${initialQuotations.length} quotation${initialQuotations.length === 1 ? "" : "s"}`}
        actions={
          <>
            {canExport && <ExportButton endpoint={exportUrl} label="Export" />}
            {canCreate && <Link href="/quotations/new" className={btn.primary}><Plus size={15} /> New quotation</Link>}
          </>
        }
      />

      {financialAccess && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat label="Awaiting client" value={formatCurrency(pipelineValue)} sub={`${(counts.SENT ?? 0) + (counts.VIEWED ?? 0)} sent`} />
          <MiniStat label="Accepted" value={formatCurrency(wonValue)} sub={`${counts.APPROVED ?? 0} won`} tone="text-success" />
          <MiniStat label="Drafts" value={String(counts.DRAFT ?? 0)} sub="Not yet sent" />
          <MiniStat label="Needs approval" value={String(counts.APPROVAL)} sub="Discount above limit" tone={counts.APPROVAL ? "text-warning" : undefined} />
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2.5 focus-within:border-primary/50">
          <Search size={16} className="text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number or client…" className="flex-1 bg-transparent text-[14px] outline-none" />
        </div>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max items-center gap-1 rounded-[10px] bg-line-soft p-1">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${tab === id ? "bg-white text-primary shadow-sm" : "text-ink-soft hover:text-ink"}`}
            >
              {label} <span className="opacity-60">{counts[id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl2 border border-line bg-white">
          <EmptyState icon={FileText} title={initialQuotations.length ? "No matches" : "No quotations yet"} note={initialQuotations.length ? "Try a different search or tab." : "Create your first quotation — it'll be printed on your letterhead."} />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl2 border border-line bg-white md:block">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line bg-appbg text-left text-[12px] font-semibold text-ink-soft">
                  <th className="px-4 py-3">Quotation</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Valid until</th>
                  <th className="px-4 py-3">Salesperson</th>
                  {financialAccess && <th className="px-4 py-3 text-right">Total</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((qt) => {
                  const expired = qt.validUntil && new Date(qt.validUntil) < new Date() && ["DRAFT", "SENT", "VIEWED"].includes(qt.status);
                  return (
                    <tr key={qt.id} className="border-b border-line-soft last:border-0 hover:bg-appbg/70">
                      <td className="px-4 py-3">
                        <Link href={`/quotations/${qt.id}`} className="font-semibold text-primary hover:underline">{qt.quotationNumber}</Link>
                        <div className="text-[12px] text-ink-faint">{formatDate(qt.createdAt)} · {qt.itemCount} items</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{qt.clientName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusChip status={qt.status} label={statusLabel(qt.status)} />
                          {qt.requiresApproval && qt.status === "DRAFT" && <span title="Needs discount approval"><AlertTriangle size={14} className="text-warning" /></span>}
                        </div>
                      </td>
                      <td className={`px-4 py-3 ${expired ? "font-medium text-danger" : "text-ink-soft"}`}>{formatDate(qt.validUntil)}</td>
                      <td className="px-4 py-3 text-ink-soft">{qt.salesperson}</td>
                      {financialAccess && <td className="px-4 py-3 text-right font-semibold text-ink">{formatCurrency(qt.total)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((qt) => (
              <Link key={qt.id} href={`/quotations/${qt.id}`} className="block rounded-xl2 border border-line bg-white p-3.5 active:scale-[0.99]">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-semibold text-ink">{qt.clientName}</div>
                    <div className="text-xs text-ink-soft">{qt.quotationNumber}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {qt.requiresApproval && qt.status === "DRAFT" && <AlertTriangle size={14} className="text-warning" />}
                    <StatusChip status={qt.status} label={statusLabel(qt.status)} />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-line-soft pt-2.5 text-xs text-ink-soft">
                  <span>{formatDate(qt.createdAt)} · {qt.salesperson}</span>
                  {financialAccess && <span className="text-[13.5px] font-bold text-ink">{formatCurrency(qt.total)}</span>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

