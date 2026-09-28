import { z } from "zod";
import { PaymentMethod, WorkerRateType } from "@prisma/client";

export const TRADES = [
  "Carpenter", "POP / False ceiling", "Painter", "Electrician", "Plumber", "Mason", "Tile fitter",
  "Fabricator / Welder", "Glass & aluminium", "Polisher", "Helper / Labour", "Supervisor", "Other",
] as const;

export const RATE_TYPE_LABEL: Record<WorkerRateType, string> = {
  LUMP_SUM: "Fixed amount",
  DAILY: "Per day",
  PER_UNIT: "Per unit (sq.ft / r.ft / nos)",
};

const opt = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v === undefined ? undefined : v || null));

export const workerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  trade: z.string().trim().min(1, "Choose a trade").max(60),
  phone: z.string().trim().min(10, "Enter a valid mobile number").max(20),
  altPhone: opt(20), address: opt(400), idProof: opt(80),
  bankName: opt(120), accountName: opt(120), accountNumber: opt(40), ifsc: opt(20), upiId: opt(80),
  defaultRate: z.number().nonnegative().nullable().optional(),
  defaultRateType: z.nativeEnum(WorkerRateType).nullable().optional(),
  notes: opt(1000),
});

export const stageInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "Every stage needs a name").max(120),
  amount: z.number().positive("Stage amounts must be more than 0"),
});

export const assignmentInputSchema = z
  .object({
    workerId: z.string().min(1, "Choose a worker"),
    scope: z.string().trim().min(1, "Describe the work").max(500),
    rateType: z.nativeEnum(WorkerRateType),
    rate: z.number().nonnegative().nullable().optional(),
    quantity: z.number().positive().nullable().optional(),
    unit: z.string().trim().max(20).nullable().optional(),
    agreedAmount: z.number().positive().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    stages: z.array(stageInputSchema).default([]),
  })
  .superRefine((d, ctx) => {
    if (d.rateType === "LUMP_SUM" && !d.agreedAmount) ctx.addIssue({ code: "custom", message: "Enter the agreed amount" });
    if (d.rateType !== "LUMP_SUM" && (!d.rate || !d.quantity)) ctx.addIssue({ code: "custom", message: "Enter the rate and the number of days / units" });
  });
export type AssignmentInput = z.infer<typeof assignmentInputSchema>;

/** Total payable: rate × quantity for daily / per-unit work, otherwise the agreed lump sum. */
export function payableFor(d: Pick<AssignmentInput, "rateType" | "rate" | "quantity" | "agreedAmount">) {
  const v = d.rateType === "LUMP_SUM" ? d.agreedAmount ?? 0 : (d.rate ?? 0) * (d.quantity ?? 0);
  return Math.round(v * 100) / 100;
}

export const workerPaymentSchema = z.object({
  assignmentId: z.string().min(1),
  stageId: z.string().nullable().optional(),
  amount: z.number().positive("Amount must be more than 0"),
  method: z.nativeEnum(PaymentMethod),
  referenceNumber: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  paidAt: z.string().nullable().optional(),
});

type Num = number | { toString(): string };
const n = (v: Num | null | undefined) => (v == null ? 0 : Number(v.toString()) || 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Payable / paid / balance for one assignment, plus per-stage breakdown. */
export function assignmentSummary(a: {
  agreedAmount: Num;
  payments: { amount: Num; stageId: string | null }[];
  stages?: { id: string; label: string; amount: Num }[];
}) {
  const payable = n(a.agreedAmount);
  const paid = r2(a.payments.reduce((s, p) => s + n(p.amount), 0));
  const stages = (a.stages ?? []).map((st) => {
    const stPaid = r2(a.payments.filter((p) => p.stageId === st.id).reduce((s, p) => s + n(p.amount), 0));
    return { id: st.id, label: st.label, amount: n(st.amount), paid: stPaid, balance: r2(Math.max(n(st.amount) - stPaid, 0)) };
  });
  const direct = r2(a.payments.filter((p) => !p.stageId).reduce((s, p) => s + n(p.amount), 0));
  return { payable, paid, balance: r2(Math.max(payable - paid, 0)), overpaid: r2(Math.max(paid - payable, 0)), direct, stages };
}

/** Project labour cost: totals and a per-trade breakdown. */
export function labourSummary(rows: { trade: string; payable: number; paid: number }[]) {
  const byTrade = new Map<string, { trade: string; payable: number; paid: number; workers: number }>();
  for (const r of rows) {
    const t = byTrade.get(r.trade) ?? { trade: r.trade, payable: 0, paid: 0, workers: 0 };
    t.payable += r.payable; t.paid += r.paid; t.workers += 1;
    byTrade.set(r.trade, t);
  }
  const payable = r2(rows.reduce((s, r) => s + r.payable, 0));
  const paid = r2(rows.reduce((s, r) => s + r.paid, 0));
  return {
    payable, paid, balance: r2(Math.max(payable - paid, 0)),
    byTrade: [...byTrade.values()].map((t) => ({ ...t, payable: r2(t.payable), paid: r2(t.paid), balance: r2(Math.max(t.payable - t.paid, 0)) })).sort((a, b) => b.payable - a.payable),
  };
}
