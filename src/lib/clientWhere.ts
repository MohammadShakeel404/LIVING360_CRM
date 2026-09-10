import { Prisma } from "@prisma/client";

export function buildClientWhere(searchParams: URLSearchParams): Prisma.ClientWhereInput {
  const q = searchParams.get("q")?.trim();
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { clientNumber: { contains: q, mode: "insensitive" } },
    ],
  };
}
