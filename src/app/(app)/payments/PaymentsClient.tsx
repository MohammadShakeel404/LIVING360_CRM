"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Wallet } from "lucide-react";
import { EmptyState, PageHeader, MethodChip, MiniStat, formatCurrency, formatDate } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
import { PAYMENT_METHODS, humanize } from "@/lib/labels";

type Row = {
  id: string; amount: number | null; method: string; referenceNumber: string | null; notes: string | null;
  paidAt: string; invoiceId: string; invoiceNumber: string; clientName: string;
};

export function PaymentsClient({ rows, canExport, financial }: { rows: Row[]; canExport: boolean; financial: boolean }) {
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("ALL");
  const filtered = useMemo(() => {
    const n = q.toLowerCase();
    return rows.filter((r) =>
      (method === "ALL" || r.method === method) &&
      (!n || r.clientName.toLowerCase().includes(n) || r.invoiceNumber.toLowerCase().includes(n) || (r.referenceNumber ?? "").toLowerCase().includes(n))
    );
  }, [rows, q, method]);

  const now = new Date();
  const sum = (xs: Row[]) => xs.reduce((s, r) => s + (r.amount ?? 0), 0);
  const thisMonth = rows.filter((r) => { const d = new Date(r.paidAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (method !== "ALL") params.set("method", method);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Payments"
        subtitle="Every payment received against invoices. Record new payments from the invoice page."
        actions={canExport ? <ExportButton endpoint={`/api/payments/export${params.toString() ? "?" + params : ""}`} label="Export" /> : undefined}
      />
      {financial && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MiniStat label="This month" value={formatCurrency(sum(thisMonth))} sub={`${thisMonth.length} payments`} tone="text-success" />
          <MiniStat label="Showing" value={formatCurrency(sum(filtered))} sub={`${filtered.length} payments`} />
          <MiniStat label="All time" value={formatCurrency(sum(rows))} sub={`${rows.length} payments`} />
        </div>
      )}
      <div className="flex flex-col gap-2.5 md:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2.5 focus-within:border-primary/50">
          <Search size={16} className="text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, invoice or reference…" className="flex-1 bg-transparent text-[14px] outline-none" />
        </div>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-xl2 border border-line bg-white px-3 py-2.5 text-[14px] outline-none">
          <option value="ALL">All methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m === "UPI" ? "UPI" : humanize(m)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl2 border border-line bg-white"><EmptyState icon={Wallet} title={rows.length ? "No matches" : "No payments yet"} note="Payments you record on invoices appear here." /></div>
      ) : (
        <div className="overflow-hidden rounded-xl2 border border-line bg-white">
          {filtered.map((r) => (
            <Link key={r.id} href={`/invoices/${r.invoiceId}`} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-ink">{r.clientName}</div>
                <div className="truncate text-[12px] text-ink-faint">{r.invoiceNumber} · {formatDate(r.paidAt)}{r.referenceNumber ? ` · Ref ${r.referenceNumber}` : ""}</div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2.5">
                <MethodChip method={r.method} />
                {financial && <span className="text-[14px] font-bold text-success">{formatCurrency(r.amount)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
