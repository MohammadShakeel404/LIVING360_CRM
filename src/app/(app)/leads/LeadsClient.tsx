"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { IndianRupee, MapPin, Search } from "lucide-react";
import { Avatar, ScoreChip, formatCurrency } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
import { NewLeadSheet } from "./NewLeadSheet";

const STAGES = [
  "NEW_LEAD", "CONTACT_ATTEMPTED", "CONTACTED", "REQUIREMENT_DISCUSSED",
  "SITE_VISIT_SCHEDULED", "SITE_VISIT_COMPLETED", "PROPOSAL_DESIGN",
  "QUOTATION_SENT", "NEGOTIATION", "CONVERTED",
] as const;

const STAGE_LABEL: Record<string, string> = {
  NEW_LEAD: "New Lead", CONTACT_ATTEMPTED: "Contact Attempted", CONTACTED: "Contacted",
  REQUIREMENT_DISCUSSED: "Requirement Discussed", SITE_VISIT_SCHEDULED: "Site Visit Scheduled",
  SITE_VISIT_COMPLETED: "Site Visit Completed", PROPOSAL_DESIGN: "Proposal / Design",
  QUOTATION_SENT: "Quotation Sent", NEGOTIATION: "Negotiation", CONVERTED: "Converted",
};

export type LeadListItem = {
  id: string;
  leadNumber: string;
  name: string;
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

  const filtered = useMemo(
    () => leads.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()) || l.leadNumber.toLowerCase().includes(q.toLowerCase())),
    [leads, q]
  );
  const byStage = useMemo(
    () => Object.fromEntries(STAGES.map((s) => [s, filtered.filter((l) => l.stage === s)])),
    [filtered]
  );

  const exportUrl = `/api/leads/export${q ? `?q=${encodeURIComponent(q)}` : ""}`;

  function closeNewLead() {
    setNewLeadOpen(false);
    router.replace("/leads");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">Leads</h1>
        <div className="flex items-center gap-2">
          {canExport && <ExportButton endpoint={exportUrl} label="Export to Excel" />}
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
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2.5">
        <Search size={16} className="text-ink-faint" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or lead ID..."
          className="flex-1 bg-transparent text-[14px] outline-none"
        />
      </div>

      {view === "List" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((l) => <LeadCard key={l.id} lead={l} financialAccess={financialAccess} />)}
          {filtered.length === 0 && <div className="text-[13.5px] text-ink-soft">No leads match your search.</div>}
        </div>
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
    <Link href={`/leads/${lead.id}`} className="block rounded-xl2 border border-line bg-white p-3.5 text-left">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={lead.name} tone="bg-dark" />
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-semibold text-ink">{lead.name}</div>
            <div className="text-xs text-ink-soft">{lead.propertyType ?? "—"}</div>
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
