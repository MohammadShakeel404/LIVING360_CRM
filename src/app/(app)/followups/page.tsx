import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { FollowupsClient } from "./FollowupsClient";

export default async function FollowupsPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "followups", "view")) {
    return <EmptyState icon={Lock} title="No access" note="Your role doesn't have access to follow-ups." />;
  }
  const scoped = role === "SALES_EXECUTIVE" ? { lead: { assignedToId: session!.user.id } } : {};

  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
  const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));
  const include = { lead: { select: { id: true, name: true } }, createdBy: { select: { name: true } } };

  const [today, overdue, upcoming, done] = await Promise.all([
    prisma.followUp.findMany({ where: { ...scoped, status: "SCHEDULED", scheduledAt: { gte: startOfToday, lte: endOfToday } }, include, orderBy: { scheduledAt: "asc" } }),
    prisma.followUp.findMany({ where: { ...scoped, status: "SCHEDULED", scheduledAt: { lt: startOfToday } }, include, orderBy: { scheduledAt: "asc" } }),
    prisma.followUp.findMany({ where: { ...scoped, status: "SCHEDULED", scheduledAt: { gt: endOfToday } }, include, orderBy: { scheduledAt: "asc" }, take: 50 }),
    prisma.followUp.findMany({ where: { ...scoped, status: "COMPLETED" }, include, orderBy: { completedAt: "desc" }, take: 30 }),
  ]);

  const shape = (rows: typeof today) =>
    rows.map((f) => ({
      id: f.id, type: f.type, status: f.status, scheduledAt: f.scheduledAt.toISOString(), notes: f.notes, outcome: f.outcome,
      by: f.createdBy.name, lead: f.lead,
    }));

  return <FollowupsClient today={shape(today)} overdue={shape(overdue)} upcoming={shape(upcoming)} done={shape(done)} canEdit={can(role, "followups", "edit")} />;
}
