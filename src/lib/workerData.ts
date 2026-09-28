import { prisma } from "@/lib/prisma";
import { sharePath } from "@/lib/settings";
import type { ReceiptRowData } from "@/components/workers/ReceiptRow";

/** Workers for the assignment picker (active only, plus any explicitly included id). */
export async function workerOptions(includeId?: string) {
  const ws = await prisma.worker.findMany({
    where: includeId ? { OR: [{ status: "ACTIVE" }, { id: includeId }] } : { status: "ACTIVE" },
    select: { id: true, name: true, trade: true, workerNumber: true, defaultRate: true, defaultRateType: true },
    orderBy: [{ trade: "asc" }, { name: "asc" }],
  });
  return ws.map((w) => ({ ...w, defaultRate: w.defaultRate ? Number(w.defaultRate) : null }));
}

export function receiptRow(
  p: { id: string; receiptNumber: string; amount: { toString(): string }; method: string; paidAt: Date; referenceNumber: string | null; stage: { label: string } | null },
  worker: { name: string; phone: string },
  context?: string
): ReceiptRowData {
  return {
    id: p.id, receiptNumber: p.receiptNumber, amount: Number(p.amount.toString()), method: p.method, paidAt: p.paidAt.toISOString(),
    referenceNumber: p.referenceNumber, stageLabel: p.stage?.label ?? null, context, sharePath: sharePath("wreceipt", p.id),
    workerName: worker.name, workerPhone: worker.phone,
  };
}
