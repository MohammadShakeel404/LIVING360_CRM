"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { IndianRupee, MapPin, Search, Plus, Flame } from "lucide-react";
import { LEAD_STAGES, LEAD_STAGE_LABEL } from "@/lib/labels";
import { Avatar, ScoreChip, EmptyState, formatCurrency, btn } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
import { NewLeadSheet } from "./NewLeadSheet";

const STAGES = LEAD_STAGES.filter((s) => s !== "LOST");
const STAGE_LABEL = LEAD_STAGE_LABEL;

export type LeadListItem = {
  id: string;
  leadNumber: string;
  name: string;
  phone: string;
  stage: string;
  score: "HOT" | "WARM" | "COLD";
  budgetMin: string | null;
  budgetMax: string | null;
  propertyType: string | null;
  projectLocation: string | null;
  location: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
};

export function LeadsClient({
  initialLeads, canExport, canCreate, financialAccess,
}: { initialLeads: LeadListItem[]; canExport: boolean; canCreate: boolean; financialAccess: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"List" | "Pipeline">("List");
  const [newLeadOpen, setNewLeadOpen] = useState(searchParams.get("new") === "1");
  const [score, setScore] = useState(searchParams.get("score") ?? "ALL");
  const [showClosed, setShowClosed] = useState(false);
  useEffect(() => { if (searchParams.get("new") === "1") setNewLeadOpen(true); }, [searchParams]);

  const filtered = useMemo(
    () => {
      const needle = q.toLowerCase();
      return leads.filter((l) =>
        (!needle || l.name.toLowerCase().includes(needle) || l.leadNumber.toLowerCase().includes(needle) || (l.phone ?? "").includes(needle)) &&
        (score === "ALL" || l.score === score) &&
        (showClosed || !(l.stage === "LOST" || l.stage === "CONVERTED") || view === "Pipeline")
      );
    },
    [leads, q, score, showClosed, view]
  );
  const byStage = useMemo(
    () => Object.fromEntries(STAGES.map((s) => [s, filtered.filter((l) => l.stage === s)])),
    [filtered]
  );

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (score !== "ALL") exportParams.set("score", score);
  const exportUrl = `/api/leads/export${exportParams.toString() ? "?" + exportParams : ""}`;

  function closeNewLead() {
    setNewLeadOpen(false);
    router.replace("/leads");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink md:text-[22px]">Leads</h1>
          <div className="text-[13px] text-ink-soft">{leads.filter((l) => l.stage !== "LOST" && l.stage !== "CONVERTED").length} active</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && <ExportButton endpoint={exportUrl} label="Export" />}
          <div className="flex items-center gap-1 rounded-[10px] bg-line-soft p-1">
            {(["List", "Pipeline"] as const).map((v) => (
              <button
                key={v} onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${view === v ? "bg-white text-primary shadow-sm" : "text-ink-soft"}`}
              >
                {v}
              </button>
            ))}
          </div>
          {canCreate && <button onClick={() => setNewLeadOpen(true)} className={btn.primary}><Plus size={15} /> New lead</button>}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2.5 focus-within:border-primary/50">
          <Search size={16} className="text-ink-faint" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone or lead ID…"
            className="flex-1 bg-transparent text-[14px] outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-[10px] bg-line-soft p-1">
            {["ALL", "HOT", "WARM", "COLD"].map((s) => (
              <button key={s} onClick={() => setScore(s)} className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold ${score === s ? "bg-white text-primary shadow-sm" : "text-ink-soft"}`}>
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          {view === "List" && (
            <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-ink-soft">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="accent-primary" /> Show closed
            </label>
          )}
        </div>
      </div>

      {view === "List" ? (
        filtered.length === 0 ? (
          <div className="rounded-xl2 border border-line bg-white">
            <EmptyState icon={Flame} title={leads.length ? "No matching leads" : "No leads yet"} note={leads.length ? "Try a different search or filter." : "Add your first lead with the New lead button."} />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((l) => <LeadCard key={l.id} lead={l} financialAccess={financialAccess} />)}
          </div>
        )
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage) => (
            <div key={stage} style={{ minWidth: 260 }} className="flex-shrink-0">
              <div className="mb-2.5 flex items-center justify-between px-1">
                <span className="text-[12.5px] font-semibold text-ink-soft">{STAGE_LABEL[stage]}</span>
                <span className="rounded-full bg-line-soft px-1.5 text-[11.5px] font-bold text-ink-faint">{byStage[stage].length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {byStage[stage].map((l) => (
                  <Link key={l.id} href={`/leads/${l.id}`} className="block rounded-xl2 border border-line bg-white p-3 text-left">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[13.5px] font-semibold text-ink">{l.name}</span>
                      <ScoreChip score={l.score} />
                    </div>
                    <div className="text-[11.5px] text-ink-soft">
                      {financialAccess ? formatCurrency(l.budgetMax ?? l.budgetMin) : "—"} · {l.projectLocation ?? l.location ?? "—"}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewLeadSheet
        open={newLeadOpen}
        onClose={closeNewLead}
        onCreated={(lead) => setLeads((ls) => [lead, ...ls])}
      />
    </div>
  );
}

function LeadCard({ lead, financialAccess }: { lead: LeadListItem; financialAccess: boolean }) {
  const overdue = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) < new Date() : false;
  return (
    <Link href={`/leads/${lead.id}`} className="block rounded-xl2 border border-line bg-white p-3.5 text-left transition-shadow hover:shadow-[0_4px_16px_rgba(37,26,81,0.07)]">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={lead.name} tone="bg-dark" />
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-semibold text-ink">{lead.name}</div>
            <div className="truncate text-xs text-ink-soft">{STAGE_LABEL[lead.stage]}{lead.propertyType ? ` · ${lead.propertyType}` : ""}</div>
          </div>
        </div>
        <ScoreChip score={lead.score} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
        <span className="flex items-center gap-1">
          <IndianRupee size={11} /> {financialAccess ? formatCurrency(lead.budgetMax ?? lead.budgetMin) : "Restricted"}
        </span>
        <span className="flex items-center gap-1"><MapPin size={11} /> {lead.projectLocation ?? lead.location ?? "—"}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-line-soft pt-2.5">
        <span className={`text-xs font-medium ${overdue ? "text-danger" : "text-ink-faint"}`}>
          {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Not scheduled"}
        </span>
        {lead.assignedTo && <Avatar name={lead.assignedTo.name} size={22} />}
      </div>
    </Link>
  );
}
