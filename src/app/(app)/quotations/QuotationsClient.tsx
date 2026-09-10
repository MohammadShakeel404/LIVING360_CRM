"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, AlertTriangle } from "lucide-react";
import { StatusChip, formatCurrency, formatDate } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
import { NewQuotationSheet } from "./NewQuotationSheet";

const STATUS_TABS = ["ALL", "DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED"] as const;

export type QuotationListItem = {
  id: string;
  quotationNumber: string;
  version: number;
  status: string;
  requiresApproval: boolean;
  discountPct: string;
  clientName: string;
  clientId: string | null;
  leadId: string | null;
  salesperson: string;
  itemCount: number;
  total: string | null;
  validUntil: string | null;
  createdAt: string;
};

export function QuotationsClient({
  initialQuotations, clients, leads, canExport, canCreate, financialAccess,
}: {
  initialQuotations: QuotationListItem[];
  clients: { id: string; name: string }[];
  leads: { id: string; name: string; leadNumber: string }[];
  canExport: boolean;
  canCreate: boolean;
  financialAccess: boolean;
}) {
  const [quotations, setQuotations] = useState(initialQuotations);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<typeof STATUS_TABS[number]>("ALL");
  const [newOpen, setNewOpen] = useState(false);

  const filtered = useMemo(
    () =>
      quotations.filter((qt) => {
        const matchQ =
          qt.quotationNumber.toLowerCase().includes(q.toLowerCase()) ||
          qt.clientName.toLowerCase().includes(q.toLowerCase());
        const matchTab = tab === "ALL" || qt.status === tab;
        return matchQ && matchTab;
      }),
    [quotations, q, tab]
  );

  const exportUrl = `/api/quotations/export${q ? `?q=${encodeURIComponent(q)}` : ""}${tab !== "ALL" ? `${q ? "&" : "?"}status=${tab}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">Quotations</h1>
        <div className="flex items-center gap-2">
          {canExport && <ExportButton endpoint={exportUrl} label="Export" />}
          {canCreate && (
            <button
              onClick={() => setNewOpen(true)}
              className="flex items-center gap-1.5 rounded-[10px] bg-primary px-3.5 py-[9px] text-[13px] font-semibold text-white"
            >
              <Plus size={15} /> New
            </button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-[10px] bg-line-soft p-1">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap ${
              tab === s ? "bg-white text-primary shadow-sm" : "text-ink-soft"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2.5">
        <Search size={16} className="text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by number or client..."
          className="flex-1 bg-transparent text-[14px] outline-none"
        />
      </div>

      {/* List */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((qt) => (
          <Link
            key={qt.id}
            href={`/quotations/${qt.id}`}
            className="block rounded-xl2 border border-line bg-white p-3.5 transition-transform active:scale-[0.98]"
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-[14.5px] font-semibold text-ink">{qt.clientName}</div>
                <div className="text-xs text-ink-soft">{qt.quotationNumber} · v{qt.version}</div>
              </div>
              <div className="flex items-center gap-1.5">
                {qt.requiresApproval && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-warning-bg" title="Requires approval">
                    <AlertTriangle size={11} className="text-warning" />
                  </div>
                )}
                <StatusChip status={qt.status} />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-ink-soft">
              <span>{qt.itemCount} item{qt.itemCount !== 1 ? "s" : ""}</span>
              {financialAccess && qt.total && (
                <span className="font-semibold text-ink">{formatCurrency(qt.total)}</span>
              )}
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-line-soft pt-2.5 text-xs text-ink-faint">
              <span>{formatDate(qt.createdAt)}</span>
              <span>{qt.salesperson}</span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="text-[13.5px] text-ink-soft">No quotations match your filters.</div>
        )}
      </div>

      <NewQuotationSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        clients={clients}
        leads={leads}
        onCreated={(qt) => setQuotations((prev) => [qt, ...prev])}
      />
    </div>
  );
}
