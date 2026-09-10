import { Prisma, QuotationStatus } from "@prisma/client";

/** Shared where-clause builder — reused by the export route. */
export function buildQuotationWhere(searchParams: URLSearchParams): Prisma.QuotationWhereInput {
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status") as QuotationStatus | null;
  const clientId = searchParams.get("clientId");
  const leadId = searchParams.get("leadId");

  const where: Prisma.QuotationWhereInput = {};
  if (q) {
    where.OR = [
      { quotationNumber: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
      { lead: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (status) where.status = status;
  if (clientId) where.clientId = clientId;
  if (leadId) where.leadId = leadId;
  return where;
}
