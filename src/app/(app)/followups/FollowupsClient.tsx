"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui";
import { FollowUpList, type FollowUpRow } from "@/components/FollowUpList";

type Tab = "today" | "overdue" | "upcoming" | "done";

export function FollowupsClient({ today, overdue, upcoming, done, canEdit }: { today: FollowUpRow[]; overdue: FollowUpRow[]; upcoming: FollowUpRow[]; done: FollowUpRow[]; canEdit: boolean }) {
  const [tab, setTab] = useState<Tab>(overdue.length && !today.length ? "overdue" : "today");
  const data = { today, overdue, upcoming, done };
  const tabs: [Tab, string][] = [["today", "Today"], ["overdue", "Overdue"], ["upcoming", "Upcoming"], ["done", "Completed"]];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Follow-ups" subtitle="Tick off calls and meetings as you go — the lead's next follow-up updates automatically." />
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max items-center gap-1 rounded-[10px] bg-line-soft p-1">
          {tabs.map(([id, label]) => (
            <button
              key={id} onClick={() => setTab(id)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-[7px] text-[13px] font-semibold ${tab === id ? `bg-white shadow-sm ${id === "overdue" ? "text-danger" : "text-primary"}` : "text-ink-soft"}`}
            >
              {label} <span className="opacity-65">{data[id].length}</span>
            </button>
          ))}
        </div>
      </div>
      <FollowUpList items={data[tab]} canEdit={canEdit} />
    </div>
  );
}
