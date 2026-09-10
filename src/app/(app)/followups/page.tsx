import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FollowupsClient } from "./FollowupsClient";

export default async function FollowupsPage() {
  const session = await getServerSession(authOptions);
  const scoped = session!.user.role === "SALES_EXECUTIVE" ? { lead: { assignedToId: session!.user.id } } : {};

  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
  const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));

  const [today, overdue, upcoming] = await Promise.all([
    prisma.followUp.findMany({
      where: { ...scoped, status: "SCHEDULED", scheduledAt: { gte: startOfToday, lte: endOfToday } },
      include: { lead: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.followUp.findMany({
      where: { ...scoped, status: "SCHEDULED", scheduledAt: { lt: startOfToday } },
      include: { lead: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.followUp.findMany({
      where: { ...scoped, status: "SCHEDULED", scheduledAt: { gt: endOfToday } },
      include: { lead: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 30,
    }),
  ]);

  const shape = (rows: typeof today) =>
    rows.map((f) => ({ id: f.id, lead: f.lead.name, time: f.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }), type: f.type, note: f.notes ?? "" }));

  return <FollowupsClient today={shape(today)} overdue={shape(overdue)} upcoming={shape(upcoming)} />;
}
