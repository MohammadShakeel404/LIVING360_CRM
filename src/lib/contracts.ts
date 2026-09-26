import { z } from "zod";

// ---- Payment schedule (agreements) --------------------------------------------------------

export const milestoneSchema = z.object({
  label: z.string().trim().min(1, "Every milestone needs a description").max(200),
  pct: z.number().positive("Milestone % must be more than 0").max(100),
});
export type Milestone = z.infer<typeof milestoneSchema>;

export const DEFAULT_SCHEDULE: Milestone[] = [
  { label: "Advance on signing the agreement", pct: 50 },
  { label: "On delivery of materials to site", pct: 40 },
  { label: "On completion and handover", pct: 10 },
];

/** Reads a stored JSON schedule defensively (settings may be empty or hand-edited). */
export function parseSchedule(v: unknown): Milestone[] {
  const r = z.array(milestoneSchema).safeParse(v);
  return r.success && r.data.length ? r.data : DEFAULT_SCHEDULE;
}

export const scheduleSchema = z
  .array(milestoneSchema)
  .min(1, "Add at least one payment milestone")
  .refine((xs) => Math.abs(xs.reduce((s, x) => s + x.pct, 0) - 100) < 0.01, "Payment milestones must add up to 100%");

export const agreementInputSchema = z.object({
  quotationId: z.string().min(1, "Choose the agreed quotation"),
  agreementDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  completionDate: z.string().optional().nullable(),
  paymentSchedule: scheduleSchema,
  terms: z.string().trim().max(8000).optional().nullable(),
  workOrderNotes: z.string().trim().max(4000).optional().nullable(),
  exclusions: z.string().trim().max(4000).optional().nullable(),
});
export type AgreementInput = z.infer<typeof agreementInputSchema>;

// ---- Change of scope ----------------------------------------------------------------------

export const cosItemSchema = z.object({
  deduction: z.boolean().default(false),
  category: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1, "Every item needs a name").max(200),
  description: z.string().trim().max(500).optional().nullable(),
  quantity: z.number().positive("Quantity must be more than 0"),
  unit: z.string().trim().min(1).max(20),
  rate: z.number().min(0),
  gstPct: z.number().min(0).max(28),
});

export const cosInputSchema = z.object({
  title: z.string().trim().min(1, "Give the change a title").max(200),
  reason: z.string().trim().max(2000).optional().nullable(),
  quotationId: z.string().optional().nullable(),
  timeImpactDays: z.number().int().min(-365).max(365).default(0),
  items: z.array(cosItemSchema).min(1, "Add at least one addition or deduction"),
});
export type CosInput = z.infer<typeof cosInputSchema>;

type Num = number | { toString(): string };
const n = (v: Num) => Number(v.toString()) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Additions minus deductions, with GST computed per line. Net can be negative (a credit). */
export function changeOrderTotals(items: { deduction: boolean; quantity: Num; rate: Num; gstPct: Num }[]) {
  let addTaxable = 0, addGst = 0, dedTaxable = 0, dedGst = 0;
  for (const i of items) {
    const amt = n(i.quantity) * n(i.rate);
    const gst = amt * (n(i.gstPct) / 100);
    if (i.deduction) { dedTaxable += amt; dedGst += gst; } else { addTaxable += amt; addGst += gst; }
  }
  const netTaxable = addTaxable - dedTaxable;
  const netGst = addGst - dedGst;
  return {
    addTaxable: r2(addTaxable), addGst: r2(addGst), dedTaxable: r2(dedTaxable), dedGst: r2(dedGst),
    netTaxable: r2(netTaxable), netGst: r2(netGst), net: r2(netTaxable + netGst),
  };
}

export const cosItemRows = (items: CosInput["items"]) =>
  items.map((i, idx) => ({ ...i, description: i.description || null, sortOrder: idx }));

/** Used when Settings → Agreement terms is empty. Review with your legal advisor before first use. */
export const DEFAULT_AGREEMENT_TERMS = [
  "The Company will execute the work described in Annexure A in line with the approved designs and specifications.",
  "Any change to the scope, materials or design after signing will be recorded as a Change of Scope (COS) and priced separately; approved COS amounts are added to (or deducted from) the contract value.",
  "Timelines start from the later of the start date or receipt of the advance, and are extended by any delay in client approvals, site access, payments or approved COS.",
  "The Client will provide site access, electricity and water during working hours, and obtain any society/building permissions required.",
  "Payments are due within 7 days of each milestone invoice. Work may be paused if payments are overdue.",
  "Materials are warranted as per the manufacturer's warranty. Workmanship is warranted for 12 months from handover, excluding misuse, water seepage and normal wear.",
  "Ownership of materials passes to the Client on full payment of the contract value.",
  "Either party may terminate with 15 days' written notice; the Client will pay for work completed and materials procured up to that date.",
  "Disputes will first be resolved amicably, failing which they are subject to the jurisdiction of the courts of the Company's registered city.",
].join("\n");

export const DEFAULT_WORK_ORDER_TERMS = [
  "Work to be executed as per the approved drawings and the scope in this work order.",
  "Any change in scope must be approved in writing through a Change of Scope (COS) before execution.",
  "Site to be handed over clean after completion of each stage.",
].join("\n");

/** Milestones as editable string drafts for form inputs. */
export const toDrafts = (xs: Milestone[]) => xs.map((m) => ({ label: m.label, pct: String(m.pct) }));

export const workOrderNumber = (agreementNumber: string) => agreementNumber.replace(/^AGR/, "WO");
