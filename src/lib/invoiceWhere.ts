import { Prisma, InvoiceStatus, InvoiceType } from "@prisma/client";

export function buildInvoiceWhere(searchParams: URLSearchParams): Prisma.InvoiceWhereInput {
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status") as InvoiceStatus | null;
  const type = searchParams.get("type") as InvoiceType | null;
  const clientId = searchParams.get("clientId");
  const projectId = searchParams.get("projectId");

  const where: Prisma.InvoiceWhereInput = {};
  if (q) {
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (status) where.status = status;
  if (type) where.type = type;
  if (clientId) where.clientId = clientId;
  if (projectId) where.projectId = projectId;
  return where;
}
