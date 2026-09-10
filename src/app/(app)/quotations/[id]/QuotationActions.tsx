"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, X as XIcon, Loader2 } from "lucide-react";

export function QuotationActions({
  quotationId,
  status,
  requiresApproval,
  canApprove,
}: {
  quotationId: string;
  status: string;
  requiresApproval: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function performAction(action: "send" | "approve" | "reject") {
    setLoading(action);
    try {
      const res = await fetch(`/api/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Something went wrong");
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const isDraft = status === "DRAFT";
  const isApproved = status === "APPROVED";
  const canSend = isDraft && (!requiresApproval || isApproved);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Send button — available for DRAFT quotations that don't need (or already got) approval */}
      {(isDraft || isApproved) && (
        <button
          disabled={!canSend || loading !== null}
          onClick={() => performAction("send")}
          className="flex items-center gap-1.5 rounded-[10px] bg-primary px-3.5 py-[9px] text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {loading === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Send to Client
        </button>
      )}

      {/* Approve / Reject — only for roles with approval power, and only when approval is pending */}
      {requiresApproval && canApprove && status !== "APPROVED" && status !== "REJECTED" && (
        <>
          <button
            disabled={loading !== null}
            onClick={() => performAction("approve")}
            className="flex items-center gap-1.5 rounded-[10px] bg-success px-3.5 py-[9px] text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {loading === "approve" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Approve
          </button>
          <button
            disabled={loading !== null}
            onClick={() => performAction("reject")}
            className="flex items-center gap-1.5 rounded-[10px] bg-danger px-3.5 py-[9px] text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {loading === "reject" ? <Loader2 size={14} className="animate-spin" /> : <XIcon size={14} />}
            Reject
          </button>
        </>
      )}
    </div>
  );
}
