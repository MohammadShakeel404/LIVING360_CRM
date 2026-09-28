import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { payableFor, type AssignmentInput } from "@/lib/workers";

const date = (v?: string | null) => (v ? new Date(v) : null);

/** Shared validation for create/update; returns the computed payable or an error message. */
export async function checkAssignment(d: AssignmentInput, alreadyPaid = 0): Promise<{ error: string } | { payable: number }> {
  const worker = await prisma.worker.findUnique({ where: { id: d.workerId }, select: { status: true, name: true } });
  if (!worker) return { error: "Worker not found." };
  const payable = payableFor(d);
  if (payable <= 0) return { error: "The payable amount must be more than zero." };
  if (payable + 0.5 < alreadyPaid) {
    return { error: `₹${alreadyPaid.toLocaleString("en-IN")} is already paid on this work — the payable amount can't be lower than that.` };
  }
  if (d.stages.length) {
    const sum = d.stages.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(sum - payable) > 1) {
      return { error: `Stage amounts add up to ₹${sum.toLocaleString("en-IN")} but the payable amount is ₹${payable.toLocaleString("en-IN")}. Make them match.` };
    }
  }
  return { payable };
}

export function assignmentData(d: AssignmentInput, payable: number) {
  const lump = d.rateType === "LUMP_SUM";
  return {
    workerId: d.workerId,
    scope: d.scope,
    rateType: d.rateType,
    rate: lump ? null : d.rate ?? null,
    quantity: lump ? null : d.quantity ?? null,
    unit: lump ? null : d.unit || (d.rateType === "DAILY" ? "days" : "units"),
    agreedAmount: payable,
    startDate: date(d.startDate),
    endDate: date(d.endDate),
    notes: d.notes || null,
  } satisfies Omit<Prisma.ProjectWorkerUncheckedCreateInput, "projectId">;
}
