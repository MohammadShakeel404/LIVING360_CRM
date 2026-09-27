"use client";

import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { btn, formatCurrency } from "@/components/ui";
import { Modal } from "@/components/Modal";
import type { CatalogForEditor } from "@/lib/catalog";
import type { EditorItem } from "./QuotationEditor";

/** Tick several price-list items at once and add them as quotation lines (quantity 1, editable after). */
export function PriceListPicker({ catalog, onClose, onAdd }: { catalog: CatalogForEditor; onClose: () => void; onAdd: (items: EditorItem[]) => void }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const groups = useMemo(() => {
    const n = q.toLowerCase();
    return catalog
      .map((c) => ({ ...c, items: c.items.filter((i) => !n || i.name.toLowerCase().includes(n) || c.name.toLowerCase().includes(n) || (i.description ?? "").toLowerCase().includes(n)) }))
      .filter((c) => c.items.length);
  }, [catalog, q]);

  const toggle = (id: string) => setPicked((s) => { const x = new Set(s); x.has(id) ? x.delete(id) : x.add(id); return x; });

  function add() {
    const lines: EditorItem[] = [];
    for (const c of catalog) for (const i of c.items) if (picked.has(i.id)) {
      lines.push({ category: c.name, name: i.name, description: i.description ?? "", quantity: "1", unit: i.unit, rate: String(i.rate), discountPct: "0", gstPct: String(i.gstPct), listRate: i.rate });
    }
    onAdd(lines);
  }

  return (
    <Modal
      open wide onClose={onClose} title="Add from price list"
      footer={<button disabled={!picked.size} onClick={add} className={btn.primary + " flex-1 py-3"}>Add {picked.size || ""} item{picked.size === 1 ? "" : "s"}</button>}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-xl2 border border-line bg-appbg px-3 py-2.5 focus-within:border-primary/50">
          <Search size={16} className="text-ink-faint" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items or categories…" className="flex-1 bg-transparent text-[14px] outline-none" />
        </div>
        {groups.length === 0 && <div className="py-6 text-center text-[13px] text-ink-soft">Nothing matches “{q}”.</div>}
        {groups.map((c) => (
          <div key={c.id}>
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-primary">{c.name}</div>
            <div className="overflow-hidden rounded-xl2 border border-line">
              {c.items.map((i) => {
                const on = picked.has(i.id);
                return (
                  <button key={i.id} type="button" onClick={() => toggle(i.id)} className={`flex w-full items-center gap-3 border-b border-line-soft px-3 py-2.5 text-left last:border-0 ${on ? "bg-primary/5" : "hover:bg-appbg"}`}>
                    <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-primary bg-primary text-white" : "border-ink-faint/50"}`}>{on && <Check size={12} strokeWidth={3} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{i.name}</span>
                      {i.description && <span className="block truncate text-[12px] text-ink-soft">{i.description}</span>}
                    </span>
                    <span className="flex-shrink-0 text-right text-[13px] font-semibold text-ink">{formatCurrency(i.rate)}<span className="text-[11.5px] font-medium text-ink-soft">/{i.unit}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
