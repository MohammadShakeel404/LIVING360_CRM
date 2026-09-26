import { prisma } from "@/lib/prisma";

/** Keeps Lead.nextFollowUpAt pointing at the earliest still-open follow-up. */
export async function syncNextFollowUp(leadId: string) {
  const next = await prisma.followUp.findFirst({ where: { leadId, status: "SCHEDULED" }, orderBy: { scheduledAt: "asc" } });
  await prisma.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: next?.scheduledAt ?? null } });
}
