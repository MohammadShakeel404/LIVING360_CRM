import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { RoleName } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, DISCOUNT_LIMITS } from "@/lib/permissions";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(20).nullable().optional(),
  role: z.nativeEnum(RoleName),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "employees", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid employee" }, { status: 422 });
  const d = parsed.data;
  if (d.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only a Super Admin can create another Super Admin." }, { status: 403 });
  }
  const exists = await prisma.user.findFirst({ where: { email: { equals: d.email, mode: "insensitive" } }, select: { id: true } });
  if (exists) return NextResponse.json({ error: "An employee with this email already exists." }, { status: 409 });

  const user = await prisma.user.create({
    data: {
      name: d.name, email: d.email, phone: d.phone || null, role: d.role,
      passwordHash: await bcrypt.hash(d.password, 10),
      maxDiscountPct: DISCOUNT_LIMITS[d.role],
    },
    select: { id: true, name: true },
  });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "EMPLOYEE_CREATED", entityType: "User", entityId: user.id, metadata: { role: d.role } } });
  return NextResponse.json({ user }, { status: 201 });
}
