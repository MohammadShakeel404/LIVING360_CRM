import { Prisma, LeadScore, LeadStage } from "@prisma/client";

/** Builds the shared where-clause from query params, reused by GET and the export route. */
export function buildLeadWhere(searchParams: URLSearchParams): Prisma.LeadWhereInput {
  const q = searchParams.get("q")?.trim();
  const stage = searchParams.get("stage") as LeadStage | null;
  const score = searchParams.get("score") as LeadScore | null;
  const assignedToId = searchParams.get("assignedToId");

  const where: Prisma.LeadWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { leadNumber: { contains: q, mode: "insensitive" } },
    ];
  }
  if (stage) where.stage = stage;
  if (score) where.score = score;
  if (assignedToId) where.assignedToId = assignedToId;
  return where;
}
