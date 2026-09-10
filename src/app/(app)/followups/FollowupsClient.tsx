"use client";

import { useState } from "react";
import { Clock, CheckCircle2 } from "lucide-react";

type Row = { id: string; lead: string; time: string; type: string; note: string };

export function FollowupsClient({ today, overdue, upcoming }: { today: Row[]; overdue: Row[]; upcoming: Row[] }) {
  const [tab, setTab] = useState<"today" | "overdue" | "upcoming">("today");
  const data = { today, overdue, upcoming };
  const tabs: [typeof tab, string, number][] = [["today", "Today", today.length], ["overdue", "Overdue", overdue.length], ["upcoming", "Upcoming", upcoming.length]];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink">Follow-ups</h1>
      <div className="flex w-fit items-center gap-1 rounded-[10px] bg-line-soft p-1">
        {tabs.map(([id, label, count]) => (
          <button
            key={id} onClick={() => setTab(id)}
            className={`rounded-lg px-3.5 py-[7px] text-[13px] font-semibold ${tab === id ? `bg-white ${id === "overdue" ? "text-danger" : "text-primary"}` : "text-ink-soft"}`}
          >
            {label} <span className="opacity-65">{count}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {data[tab].length === 0 && <div className="text-[13.5px] text-ink-soft">Nothing here.</div>}
        {data[tab].map((f) => (
          <div key={f.id} className="flex items-start gap-3 rounded-xl2 border border-line bg-white p-3">
            <div className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] ${tab === "overdue" ? "bg-danger-bg" : "bg-line-soft"}`}>
              {tab === "overdue" ? <Clock size={16} className="text-danger" /> : <CheckCircle2 size={16} className="text-primary" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold text-ink">{f.lead} · {f.type.replaceAll("_", " ")}</span>
                <span className={`text-xs font-medium ${tab === "overdue" ? "text-danger" : "text-ink-faint"}`}>{f.time}</span>
              </div>
              {f.note && <div className="mt-0.5 text-[12.5px] text-ink-soft">{f.note}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
