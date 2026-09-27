"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Loader2, BookOpen, Sparkles, FolderPlus } from "lucide-react";
import { EmptyState, Field, PageHeader, inputCls, btn, formatCurrency } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";
import { CATALOG_UNITS } from "@/lib/catalog";

type Item = { id: string; categoryId: string; name: string; description: string | null; unit: string; rate: number; gstPct: number; active: boolean };
type Cat = { id: string; name: string; active: boolean; items: Item[] };

async function call(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export function PriceListClient({ categories, canManage, showRates }: { categories: Cat[]; canManage: boolean; showRates: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const cat = categories.find((c) => c.id === sel);
  const items = useMemo(() => {
    const n = q.toLowerCase();
    const pool = sel === "ALL" ? categories.flatMap((c) => c.items) : cat?.items ?? [];
    return pool.filter((i) => !n || i.name.toLowerCase().includes(n) || (i.description ?? "").toLowerCase().includes(n));
  }, [categories, sel, cat, q]);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

  async function run(key: string, fn: () => Promise<any>) {
    setBusy(key);
    try {
      const data = await fn();
      if (data?.message) toast(data.message);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function addCategory() {
    const name = await ask({ title: "New category", input: { label: "Category name", placeholder: "e.g. Pooja Unit, Bathroom Vanity" }, confirmLabel: "Add category" });
    if (name) run("addcat", () => call("/api/catalog/categories", "POST", { name }).then((d) => { setSel(d.category.id); return d; }));
  }
  async function renameCategory(c: Cat) {
    const name = await ask({ title: "Rename category", input: { label: "Category name", defaultValue: c.name }, confirmLabel: "Save" });
    if (name && name !== c.name) run("rename", () => call(`/api/catalog/categories/${c.id}`, "PATCH", { name }));
  }
  async function deleteCategory(c: Cat) {
    if ((await ask({ title: `Delete category “${c.name}”?`, message: c.items.length ? "It still has items — delete or move them first." : undefined, danger: true, confirmLabel: "Delete" })) === null) return;
    run("delcat", () => call(`/api/catalog/categories/${c.id}`, "DELETE").then((d) => { setSel("ALL"); return d; }));
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Price list"
        subtitle={canManage ? "Standard categories, items and rates used when building quotations. Rates stay editable in each quotation." : "Standard items and rates used in quotations."}
        actions={canManage && categories.length > 0 ? (
          <>
            <button onClick={addCategory} disabled={busy !== null} className={btn.secondary}><FolderPlus size={15} /> Category</button>
            <button onClick={() => setEditing("new")} className={btn.primary}><Plus size={15} /> Item</button>
          </>
        ) : undefined}
      />

      {categories.length === 0 ? (
        <div className="rounded-xl2 border border-line bg-white">
          <EmptyState icon={BookOpen} title="Your price list is empty" note={canManage ? "Start with a ready-made interior price list and edit the rates, or add your own categories." : "An admin hasn't set up the price list yet."} />
          {canManage && (
            <div className="flex flex-wrap justify-center gap-2 pb-8">
              <button disabled={busy !== null} onClick={() => run("starter", () => call("/api/catalog/starter", "POST"))} className={btn.primary}>
                {busy === "starter" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Load starter price list
              </button>
              <button onClick={addCategory} className={btn.secondary}><FolderPlus size={15} /> Add a category</button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[230px_1fr]">
          {/* Categories */}
          <nav className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
            <div className="flex w-max gap-1.5 md:w-auto md:flex-col">
              {[{ id: "ALL", name: "All items", active: true, items: categories.flatMap((c) => c.items) } as Cat, ...categories].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSel(c.id)}
                  className={`flex items-center justify-between gap-3 whitespace-nowrap rounded-[10px] px-3 py-2 text-left text-[13.5px] font-medium ${sel === c.id ? "bg-primary text-white" : "bg-white text-ink ring-1 ring-line hover:ring-primary/40"} ${!c.active ? "opacity-60" : ""}`}
                >
                  <span className="truncate">{c.name}{!c.active ? " (hidden)" : ""}</span>
                  <span className={`text-[12px] ${sel === c.id ? "text-white/80" : "text-ink-faint"}`}>{c.items.length}</span>
                </button>
              ))}
            </div>
          </nav>

          <div className="flex min-w-0 flex-col gap-3">
            {cat && canManage && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl2 border border-line bg-white p-2.5">
                <span className="mr-auto pl-1 text-[14px] font-semibold text-ink">{cat.name}</span>
                <button title="Move up" aria-label="Move category up" onClick={() => run("up", () => call(`/api/catalog/categories/${cat.id}`, "PATCH", { move: -1 }))} className="rounded-lg p-2 text-ink-soft hover:bg-appbg"><ChevronUp size={16} /></button>
                <button title="Move down" aria-label="Move category down" onClick={() => run("down", () => call(`/api/catalog/categories/${cat.id}`, "PATCH", { move: 1 }))} className="rounded-lg p-2 text-ink-soft hover:bg-appbg"><ChevronDown size={16} /></button>
                <button onClick={() => renameCategory(cat)} className={btn.secondary + " py-1.5"}><Pencil size={14} /> Rename</button>
                <button onClick={() => run("hide", () => call(`/api/catalog/categories/${cat.id}`, "PATCH", { active: !cat.active }))} className={btn.secondary + " py-1.5"}>
                  {cat.active ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
                </button>
                <button onClick={() => deleteCategory(cat)} className={btn.danger + " py-1.5"}><Trash2 size={14} /></button>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2.5 focus-within:border-primary/50">
              <Search size={16} className="text-ink-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" className="flex-1 bg-transparent text-[14px] outline-none" />
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl2 border border-dashed border-line bg-white p-6 text-center text-[13px] text-ink-soft">
                {q ? "No items match your search." : "No items in this category yet."}
                {canManage && !q && <div className="mt-3"><button onClick={() => setEditing("new")} className={btn.primary}><Plus size={15} /> Add item</button></div>}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl2 border border-line bg-white">
                {items.map((i) => (
                  <div key={i.id} className={`flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-0 ${!i.active ? "opacity-55" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-ink">{i.name}</span>
                        {sel === "ALL" && <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-medium text-ink-soft">{catName(i.categoryId)}</span>}
                        {!i.active && <span className="text-[11px] font-semibold text-ink-faint">HIDDEN</span>}
                      </div>
                      {i.description && <div className="truncate text-[12.5px] text-ink-soft">{i.description}</div>}
                    </div>
                    {showRates && (
                      <div className="flex-shrink-0 text-right">
                        <div className="text-[14px] font-bold text-ink">{formatCurrency(i.rate)}<span className="text-[12px] font-medium text-ink-soft"> / {i.unit}</span></div>
                        <div className="text-[11.5px] text-ink-faint">GST {i.gstPct}%</div>
                      </div>
                    )}
                    {canManage && (
                      <div className="flex flex-shrink-0 items-center">
                        <button aria-label={`Edit ${i.name}`} title="Edit" onClick={() => setEditing(i)} className="rounded-lg p-2 text-ink-soft hover:bg-appbg hover:text-primary"><Pencil size={15} /></button>
                        <button aria-label={i.active ? "Hide" : "Show"} title={i.active ? "Hide from quotations" : "Show in quotations"} disabled={busy !== null}
                          onClick={() => run(`vis-${i.id}`, () => call(`/api/catalog/items/${i.id}`, "PATCH", { active: !i.active }))} className="rounded-lg p-2 text-ink-soft hover:bg-appbg">
                          {i.active ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button aria-label={`Delete ${i.name}`} title="Delete" disabled={busy !== null}
                          onClick={async () => (await ask({ title: `Delete “${i.name}”?`, message: "Existing quotations keep their own copy of this item.", danger: true, confirmLabel: "Delete" })) !== null && run(`del-${i.id}`, () => call(`/api/catalog/items/${i.id}`, "DELETE"))}
                          className="rounded-lg p-2 text-ink-faint hover:bg-danger-bg hover:text-danger">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <ItemModal
          item={editing === "new" ? null : editing}
          categories={categories}
          defaultCategoryId={cat?.id ?? categories[0]?.id ?? ""}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function ItemModal({ item, categories, defaultCategoryId, onClose, onSaved }: { item: Item | null; categories: Cat[]; defaultCategoryId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    categoryId: item?.categoryId ?? defaultCategoryId, name: item?.name ?? "", description: item?.description ?? "",
    unit: item?.unit ?? "Sq.ft", rate: item ? String(item.rate) : "", gstPct: item ? String(item.gstPct) : "18",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try {
      const body = { ...f, rate: Number(f.rate), gstPct: Number(f.gstPct) };
      const data = await call(item ? `/api/catalog/items/${item.id}` : "/api/catalog/items", item ? "PATCH" : "POST", body);
      toast(data.message ?? "Saved.");
      onSaved();
    } catch (e: any) {
      toast(e.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal
      open onClose={onClose} title={item ? "Edit item" : "Add item to price list"}
      footer={<button disabled={busy || !f.name.trim() || f.rate === "" || !f.categoryId} onClick={save} className={btn.primary + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} {item ? "Save changes" : "Add item"}</button>}
    >
      <div className="flex flex-col gap-3">
        <Field label="Category *">
          <select className={inputCls} value={f.categoryId} onChange={set("categoryId")}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.active ? "" : " (hidden)"}</option>)}
          </select>
        </Field>
        <Field label="Item name *"><input autoFocus className={inputCls} value={f.name} onChange={set("name")} placeholder="e.g. Hinged wardrobe" /></Field>
        <Field label="Specification" hint="Printed under the item on the quotation."><input className={inputCls} value={f.description} onChange={set("description")} placeholder="Material, finish, brand…" /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Rate (₹) *"><input type="number" min={0} step="any" className={inputCls} value={f.rate} onChange={set("rate")} /></Field>
          <Field label="Per">
            <select className={inputCls} value={f.unit} onChange={set("unit")}>{[...new Set([...CATALOG_UNITS, f.unit])].map((u) => <option key={u}>{u}</option>)}</select>
          </Field>
          <Field label="GST">
            <select className={inputCls} value={f.gstPct} onChange={set("gstPct")}>{["0", "5", "12", "18", "28"].map((g) => <option key={g} value={g}>{g}%</option>)}</select>
          </Field>
        </div>
        {item && <div className="text-[12px] text-ink-faint">Changing the rate only affects new quotations — existing ones keep their prices.</div>}
      </div>
    </Modal>
  );
}
