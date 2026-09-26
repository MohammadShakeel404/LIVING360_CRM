import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageContracts } from "@/lib/permissions";
import { nextNumber } from "@/lib/numbering";
import { cosInputSchema, cosItemRows } from "@/lib/contracts";

const createSchema = cosInputSchema.extend({ projectId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContracts(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid change of scope" }, { status: 422 });
  const d = parsed.data;
  const project = await prisma.project.findUnique({ where: { id: d.projectId }, select: { id: true, clientId: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (d.quotationId) {
    const q = await prisma.quotation.findUnique({ where: { id: d.quotationId }, select: { clientId: true } });
    if (!q || q.clientId !== project.clientId) return NextResponse.json({ error: "That quotation belongs to a different client." }, { status: 422 });
  }

  const cos = await prisma.changeOrder.create({
    data: {
      cosNumber: await nextNumber("changeOrder", `COS-${new Date().getFullYear()}-`),
      projectId: project.id,
      quotationId: d.quotationId || null,
      title: d.title,
      reason: d.reason || null,
      timeImpactDays: d.timeImpactDays,
      createdById: session.user.id,
      items: { create: cosItemRows(d.items) },
    },
  });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "COS_CREATED", entityType: "ChangeOrder", entityId: cos.id } });
  return NextResponse.json({ changeOrder: { id: cos.id, cosNumber: cos.cosNumber } }, { status: 201 });
}
