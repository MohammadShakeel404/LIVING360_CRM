import { z } from "zod";
import type { RoleName } from "@prisma/client";
import { DISCOUNT_LIMITS } from "@/lib/permissions";
import { quotationTotals } from "@/lib/totals";

export const quotationItemSchema = z.object({
  category: z.string().trim().min(1),
  name: z.string().trim().min(1, "Every item needs a name"),
  description: z.string().trim().max(500).optional().nullable(),
  quantity: z.number().positive("Quantity must be more than 0"),
  unit: z.string().trim().min(1),
  rate: z.number().min(0),
  discountPct: z.number().min(0).max(100).default(0),
  gstPct: z.number().min(0).max(28).default(18),
});

export const quotationInputSchema = z.object({
  leadId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  termsAndConditions: z.string().max(4000).optional().nullable(),
  discountPct: z.number().min(0).max(100).default(0),
  items: z.array(quotationItemSchema).min(1, "Add at least one line item"),
});
export type QuotationInput = z.infer<typeof quotationInputSchema>;

/** Effective discount across line + overall discounts, compared against the creator's role limit. */
export function needsApproval(role: RoleName, input: Pick<QuotationInput, "items" | "discountPct">) {
  const t = quotationTotals(input.items, input.discountPct);
  const effectivePct = t.subtotal > 0 ? ((t.itemDiscounts + t.overallDiscount) / t.subtotal) * 100 : 0;
  return { requiresApproval: effectivePct > (DISCOUNT_LIMITS[role] ?? 0) + 0.001, effectivePct };
}

export function itemRows(items: QuotationInput["items"]) {
  return items.map((i, idx) => ({
    category: i.category,
    name: i.name,
    description: i.description || null,
    quantity: i.quantity,
    unit: i.unit,
    rate: i.rate,
    discountPct: i.discountPct,
    gstPct: i.gstPct,
    sortOrder: idx,
  }));
}
