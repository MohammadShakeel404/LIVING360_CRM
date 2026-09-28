"use client";

import { Plus, Trash2 } from "lucide-react";
import { inputCls, formatCurrency } from "@/components/ui";

export type MilestoneDraft = { label: string; pct: string };

/** Payment schedule rows (description + %), with a running total that must reach 100%. */
export function MilestoneEditor({
  value, onChange, total, disabled,
}: { value: MilestoneDraft[]; onChange: (v: MilestoneDraft[]) => void; total?: number; disabled?: boolean }) {
  const sum = value.reduce((s, m) => s + (Number(m.pct) || 0), 0);
  const upd = (i: number, k: keyof MilestoneDraft, v: string) => onChange(value.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  return (
    <div className="flex flex-col gap-2">
      {value.map((m, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 text-right text-[12.5px] font-semibold text-ink-faint">{i + 1}.</span>
          <input disabled={disabled} className={inputCls + " flex-1"} value={m.label} placeholder="e.g. On delivery of materials" onChange={(e) => upd(i, "label", e.target.value)} aria-label={`Milestone ${i + 1}`} />
          <div className="relative w-[92px] flex-shrink-0">
            <input disabled={disabled} type="number" min={0} max={100} step="0.5" className={inputCls + " pr-7 text-right"} value={m.pct} onChange={(e) => upd(i, "pct", e.target.value)} aria-label={`Milestone ${i + 1} percent`} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint">%</span>
          </div>
          {total !== undefined && <span className="hidden w-[96px] text-right text-[13px] font-medium text-ink-soft md:block">{formatCurrency((total * (Number(m.pct) || 0)) / 100)}</span>}
          <button type="button" disabled={disabled || value.length === 1} aria-label="Remove milestone" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-md p-2 text-ink-faint hover:bg-danger-bg hover:text-danger disabled:opacity-30">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pl-7">
        <button type="button" disabled={disabled} onClick={() => onChange([...value, { label: "", pct: String(Math.max(0, 100 - sum)) }])} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary disabled:opacity-40">
          <Plus size={14} /> Add milestone
        </button>
        <span className={`text-[13px] font-semibold ${Math.abs(sum - 100) < 0.01 ? "text-success" : "text-danger"}`}>Total {sum}%{Math.abs(sum - 100) < 0.01 ? "" : " — must be 100%"}</span>
      </div>
    </div>
  );
}

export const fromDrafts = (xs: MilestoneDraft[]) => xs.map((m) => ({ label: m.label.trim(), pct: Number(m.pct) || 0 }));
