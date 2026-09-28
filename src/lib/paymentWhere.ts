import { Prisma, PaymentMethod } from "@prisma/client";

export function buildPaymentWhere(searchParams: URLSearchParams): Prisma.PaymentWhereInput {
  const q = searchParams.get("q")?.trim();
  const method = searchParams.get("method") as PaymentMethod | null;
  const invoiceId = searchParams.get("invoiceId");

  const where: Prisma.PaymentWhereInput = {};
  if (q) {
    where.OR = [
      { referenceNumber: { contains: q, mode: "insensitive" } },
      { invoice: { invoiceNumber: { contains: q, mode: "insensitive" } } },
      { invoice: { client: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }
  if (method) where.method = method;
  if (invoiceId) where.invoiceId = invoiceId;
  return where;
}
