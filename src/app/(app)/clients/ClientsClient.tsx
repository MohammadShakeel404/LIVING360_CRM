"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar, EmptyState, formatCurrency } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
import { Users } from "lucide-react";

const STAGE_LABEL: Record<string, string> = {
  PLANNING: "Planning", DESIGN: "Design", APPROVAL: "Approval", PRODUCTION: "Production",
  PROCUREMENT: "Procurement", EXECUTION: "Execution", INSTALLATION: "Installation",
  HANDOVER: "Handover", COMPLETED: "Completed",
};

type ClientItem = {
  id: string; clientNumber: string; name: string;
  propertyType: string | null; projectStage: string | null; projectValue: string | null;
};

export function ClientsClient({ clients, canExport, financialAccess }: { clients: ClientItem[]; canExport: boolean; financialAccess: boolean }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.clientNumber.toLowerCase().includes(q.toLowerCase())), [clients, q]);
  const exportUrl = `/api/clients/export${q ? `?q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-ink md:text-[22px]">Clients</h1><div className="text-[13px] text-ink-soft">{clients.length} converted client{clients.length === 1 ? "" : "s"}</div></div>
        {canExport && <ExportButton endpoint={exportUrl} label="Export to Excel" />}
      </div>

      <div className="flex items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2.5">
        <Search size={16} className="text-ink-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients by name..." className="flex-1 bg-transparent text-[14px] outline-none" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No clients yet" note="Converted leads show up here with their full project history." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="block rounded-xl2 border border-line bg-white p-3.5 transition-shadow hover:shadow-[0_4px_16px_rgba(37,26,81,0.07)]">
              <div className="mb-3 flex items-center gap-2.5">
                <Avatar name={c.name} tone="bg-dark" size={40} />
                <div>
                  <div className="text-[14.5px] font-semibold text-ink">{c.name}</div>
                  <div className="text-xs text-ink-soft">{c.clientNumber} · {c.propertyType ?? "—"}</div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-success-bg px-2.5 py-2">
                <span className="text-xs font-semibold text-success">{c.projectStage ? STAGE_LABEL[c.projectStage] : "Not started"}</span>
                {financialAccess && c.projectValue && <span className="text-xs font-bold text-success">{formatCurrency(c.projectValue)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
