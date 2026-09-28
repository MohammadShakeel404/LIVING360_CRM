"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Check, X, Loader2, Pencil, Copy, Receipt, UserCheck, Trash2, RotateCcw, ShieldCheck } from "lucide-react";
import { btn } from "@/components/ui";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";

type Action = "approve" | "send" | "accept" | "reject" | "revise" | "reopen";

export function QuotationActions({
  id, status, requiresApproval, canApprove, canEditItems, canDelete, canInvoice, clientId, leadId, canConvert, hasRevision,
}: {
  id: string;
  status: string;
  requiresApproval: boolean;
  canApprove: boolean;
  canEditItems: boolean;
  canDelete: boolean;
  canInvoice: boolean;
  clientId: string | null;
  leadId: string | null;
  canConvert: boolean;
  hasRevision: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<Response>, after?: (body: any) => void) {
    setBusy(key);
    try {
      const res = await fn();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      if (body.message) toast(body.message);
      after ? after(body) : router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  const act = (action: Action, confirmText?: string) => async () => {
    if (confirmText && (await ask({ title: confirmText, danger: action === "reject", confirmLabel: "Yes, continue" })) === null) return;
    run(action, () => fetch(`/api/quotations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }),
      action === "revise" ? (b) => router.push(`/quotations/${b.id}/edit`) : undefined);
  };

  const Btn = ({ k, cls, icon: Icon, children, onClick }: { k: string; cls: string; icon: any; children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} disabled={busy !== null} className={cls}>
      {busy === k ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />} {children}
    </button>
  );

  const draft = status === "DRAFT";
  const open = status === "SENT" || status === "VIEWED";

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4 empty:hidden">
      {draft && canEditItems && <Link href={`/quotations/${id}/edit`} className={btn.secondary}><Pencil size={15} /> Edit</Link>}
      {draft && requiresApproval && canApprove && (
        <>
          <Btn k="approve" cls={btn.success} icon={ShieldCheck} onClick={act("approve")}>Approve discount</Btn>
          <Btn k="reject" cls={btn.danger} icon={X} onClick={act("reject", "Decline this quotation's discount and mark it rejected?")}>Decline</Btn>
        </>
      )}
      {draft && !requiresApproval && (
        <Btn k="send" cls={btn.primary} icon={Send} onClick={act("send")}>Mark as sent</Btn>
      )}

      {open && (
        <>
          <Btn k="accept" cls={btn.success} icon={Check} onClick={act("accept")}>Client accepted</Btn>
          <Btn k="reject" cls={btn.danger} icon={X} onClick={act("reject", "Mark this quotation as rejected by the client?")}>Client rejected</Btn>
        </>
      )}

      {status === "APPROVED" && canInvoice && clientId && (
        <Link href={`/invoices/new?quotationId=${id}`} className={btn.primary}><Receipt size={15} /> Create invoice</Link>
      )}
      {status === "APPROVED" && !clientId && leadId && canConvert && (
        <Btn
          k="convert" cls={btn.primary} icon={UserCheck}
          onClick={() => run("convert", () => fetch(`/api/leads/${leadId}/convert`, { method: "POST" }))}
        >
          Convert lead to client
        </Btn>
      )}

      {(open || status === "REJECTED" || status === "EXPIRED" || status === "APPROVED") && !hasRevision && canEditItems && (
        <Btn k="revise" cls={btn.secondary} icon={Copy} onClick={act("revise", open ? "Create a revised version? This one will be marked expired." : undefined)}>Create revision</Btn>
      )}
      {(status === "REJECTED" || status === "EXPIRED") && !hasRevision && (
        <Btn k="reopen" cls={btn.secondary} icon={RotateCcw} onClick={act("reopen")}>Reopen as draft</Btn>
      )}

      {canDelete && (
        <Btn
          k="delete" cls={btn.danger + " md:ml-auto"} icon={Trash2}
          onClick={async () => {
            if ((await ask({ title: "Delete this quotation permanently?", danger: true, confirmLabel: "Delete" })) === null) return;
            run("delete", () => fetch(`/api/quotations/${id}`, { method: "DELETE" }), () => { toast("Quotation deleted."); router.push("/quotations"); router.refresh(); });
          }}
        >
          Delete
        </Btn>
      )}
    </div>
  );
}
