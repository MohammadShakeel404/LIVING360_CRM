import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, DISCOUNT_LIMITS } from "@/lib/permissions";
import { QuotationStatus } from "@prisma/client";
import { z } from "zod";
import { buildQuotationWhere } from "@/lib/quotationWhere";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = buildQuotationWhere(req.nextUrl.searchParams);
  const scoped =
    session.user.role === "SALES_EXECUTIVE"
      ? { ...where, salespersonId: session.user.id }
      : where;

  const quotations = await prisma.quotation.findMany({
    where: scoped,
    include: {
      client: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
      salesperson: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const financial = can(session.user.role, "quotations", "financial");
  const shaped = quotations.map((q) => ({
    ...q,
    discountPct: q.discountPct.toString(),
    items: financial
      ? q.items.map((item) => ({
          ...item,
          quantity: item.quantity.toString(),
          rate: item.rate.toString(),
          discountPct: item.discountPct.toString(),
          gstPct: item.gstPct.toString(),
        }))
      : [],
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    validUntil: q.validUntil?.toISOString() ?? null,
  }));

  return NextResponse.json({ quotations: shaped });
}

const itemSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  rate: z.number().positive(),
  discountPct: z.number().min(0).max(100).default(0),
  gstPct: z.number().min(0).default(18),
  sortOrder: z.number().int().default(0),
});

const createSchema = z.object({
  leadId: z.string().optional(),
  clientId: z.string().optional(),
  validUntil: z.string().optional(),
  termsAndConditions: z.string().optional(),
  discountPct: z.number().min(0).max(100).default(0),
  items: z.array(itemSchema).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const data = parsed.data;

  const count = await prisma.quotation.count();
  const year = new Date().getFullYear();
  const quotationNumber = `QT-${year}-${(count + 1).toString().padStart(4, "0")}`;

  // Discount-approval workflow
  const userRole = session.user.role;
  const discountLimit = DISCOUNT_LIMITS[userRole] ?? 0;
  const requiresApproval = data.discountPct > discountLimit;

  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber,
      salespersonId: session.user.id,
      leadId: data.leadId || null,
      clientId: data.clientId || null,
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      termsAndConditions: data.termsAndConditions || null,
      discountPct: data.discountPct,
      requiresApproval,
      status: "DRAFT",
      items: {
        create: data.items.map((item, idx) => ({
          category: item.category,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          discountPct: item.discountPct,
          gstPct: item.gstPct,
          sortOrder: item.sortOrder ?? idx,
        })),
      },
    },
    include: { items: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "QUOTATION_CREATED",
      entityType: "Quotation",
      entityId: quotation.id,
    },
  });

  return NextResponse.json({ quotation, requiresApproval }, { status: 201 });
}
