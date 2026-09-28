import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageContracts } from "@/lib/permissions";
import { nextNumber } from "@/lib/numbering";
import { quotationTotals } from "@/lib/totals";
import { agreementInputSchema } from "@/lib/contracts";

const createSchema = agreementInputSchema.extend({ projectId: z.string().min(1) });
const date = (v?: string | null) => (v ? new Date(v) : null);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContracts(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid agreement" }, { status: 422 });
  const d = parsed.data;

  const project = await prisma.project.findUnique({ where: { id: d.projectId }, select: { id: true, clientId: true, value: true, startDate: true, expectedCompletion: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const existing = await prisma.agreement.findFirst({ where: { projectId: project.id, status: { not: "CANCELLED" } }, select: { agreementNumber: true } });
  if (existing) return NextResponse.json({ error: `This project already has agreement ${existing.agreementNumber}. Cancel it first to create a new one.` }, { status: 409 });

  const q = await prisma.quotation.findUnique({ where: { id: d.quotationId }, include: { items: true } });
  if (!q || q.clientId !== project.clientId) return NextResponse.json({ error: "Choose a quotation of this project's client." }, { status: 422 });
  if (q.status !== "APPROVED") return NextResponse.json({ error: "Only a quotation the client has accepted can be used for the agreement." }, { status: 422 });

  const contractValue = quotationTotals(q.items, q.discountPct).grandTotal;
  const agreement = await prisma.agreement.create({
    data: {
      agreementNumber: await nextNumber("agreement", `AGR-${new Date().getFullYear()}-`),
      projectId: project.id,
      quotationId: q.id,
      agreementDate: date(d.agreementDate) ?? new Date(),
      startDate: date(d.startDate) ?? project.startDate,
      completionDate: date(d.completionDate) ?? project.expectedCompletion,
      contractValue,
      paymentSchedule: d.paymentSchedule,
      terms: d.terms || null,
      workOrderNotes: d.workOrderNotes || null,
      exclusions: d.exclusions || null,
      createdById: session.user.id,
    },
  });
  // Keep the project in step with what was agreed.
  await prisma.project.update({
    where: { id: project.id },
    data: {
      value: project.value ?? contractValue,
      startDate: project.startDate ?? agreement.startDate,
      expectedCompletion: project.expectedCompletion ?? agreement.completionDate,
    },
  });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "AGREEMENT_CREATED", entityType: "Agreement", entityId: agreement.id } });
  return NextResponse.json({ agreement: { id: agreement.id, agreementNumber: agreement.agreementNumber } }, { status: 201 });
}
