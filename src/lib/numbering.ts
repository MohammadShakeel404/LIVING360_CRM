import { prisma } from "@/lib/prisma";

type NumberedModel = "lead" | "client" | "quotation" | "invoice" | "project" | "agreement" | "changeOrder";
const FIELD: Record<NumberedModel, string> = {
  lead: "leadNumber", client: "clientNumber", quotation: "quotationNumber", invoice: "invoiceNumber", project: "projectNumber",
  agreement: "agreementNumber", changeOrder: "cosNumber",
};

/**
 * Next human-readable number, e.g. nextNumber("invoice", `INV-2026-`) → "INV-2026-0007".
 * Uses max(existing)+1 rather than count()+1 so deletions never cause duplicates.
 * ponytail: scans all numbers with the prefix; switch to a DB sequence if this ever gets slow.
 */
export async function nextNumber(model: NumberedModel, prefix: string, start = 0, pad = 4) {
  const field = FIELD[model];
  const rows: Record<string, string>[] = await (prisma as any)[model].findMany({
    where: { [field]: { startsWith: prefix } },
    select: { [field]: true },
  });
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r[field].slice(prefix.length), 10) || 0), start);
  return `${prefix}${String(max + 1).padStart(pad, "0")}`;
}
