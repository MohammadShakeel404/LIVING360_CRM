import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { RoleName, EmployeeStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, DISCOUNT_LIMITS } from "@/lib/permissions";

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  role: z.nativeEnum(RoleName).optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(100).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = session.user;
  if (!can(me.role, "employees", "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, role: true, deletedAt: true } });
  if (!target || target.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 422 });
  const d = parsed.data;

  const touchesSuper = target.role === "SUPER_ADMIN" || d.role === "SUPER_ADMIN";
  if (touchesSuper && me.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can change Super Admin accounts." }, { status: 403 });
  if (target.id === me.id && (d.status === "INACTIVE" || (d.role && d.role !== me.role))) {
    return NextResponse.json({ error: "You can't deactivate yourself or change your own role." }, { status: 422 });
  }
  if (target.role === "SUPER_ADMIN" && (d.status === "INACTIVE" || (d.role && d.role !== "SUPER_ADMIN"))) {
    const others = await prisma.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE", id: { not: target.id } } });
    if (!others) return NextResponse.json({ error: "There must always be at least one active Super Admin." }, { status: 422 });
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      name: d.name,
      phone: d.phone === undefined ? undefined : d.phone || null,
      role: d.role,
      status: d.status,
      maxDiscountPct: d.role ? DISCOUNT_LIMITS[d.role] : undefined,
      passwordHash: d.password ? await bcrypt.hash(d.password, 10) : undefined,
    },
  });
  await prisma.activityLog.create({
    data: { userId: me.id, action: d.password ? "EMPLOYEE_PASSWORD_RESET" : "EMPLOYEE_UPDATED", entityType: "User", entityId: target.id, metadata: { role: d.role, status: d.status } },
  });
  return NextResponse.json({ ok: true });
}

/**
 * Removes an employee. With no history the row is deleted outright; otherwise the account is
 * anonymised and hidden (deletedAt) so quotations, follow-ups and logs keep their author.
 * Open leads and tasks are unassigned either way so nothing is left with a ghost owner.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = session.user;
  if (!can(me.role, "employees", "delete")) return NextResponse.json({ error: "Only a Super Admin can delete employees." }, { status: 403 });
  if (params.id === me.id) return NextResponse.json({ error: "You can't delete your own account." }, { status: 422 });

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, role: true, deletedAt: true,
      _count: { select: { followUps: true, quotationsCreated: true, documentsUploaded: true, activity: true, agreementsCreated: true, changeOrdersCreated: true, workerPaymentsRecorded: true } },
    },
  });
  if (!target || target.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "SUPER_ADMIN") {
    const others = await prisma.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null, id: { not: target.id } } });
    if (!others) return NextResponse.json({ error: "There must always be at least one active Super Admin." }, { status: 422 });
  }

  await prisma.$transaction([
    prisma.lead.updateMany({ where: { assignedToId: target.id }, data: { assignedToId: null } }),
    prisma.task.updateMany({ where: { assigneeId: target.id, status: { not: "COMPLETED" } }, data: { assigneeId: null } }),
    prisma.siteVisit.updateMany({ where: { assignedToId: target.id, completedAt: null }, data: { assignedToId: null } }),
    prisma.project.updateMany({ where: { projectManagerId: target.id, stage: { not: "COMPLETED" } }, data: { projectManagerId: null } }),
    prisma.notification.deleteMany({ where: { userId: target.id } }),
  ]);

  const hasHistory = Object.values(target._count).some((n) => n > 0);
  if (hasHistory) {
    await prisma.user.update({
      where: { id: target.id },
      data: {
        status: "INACTIVE",
        deletedAt: new Date(),
        email: `deleted-${target.id}@removed.invalid`,
        phone: null,
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 10),
      },
    });
  } else {
    // Completed tasks / visits / projects may still point at them; detach before the hard delete.
    await prisma.$transaction([
      prisma.task.updateMany({ where: { assigneeId: target.id }, data: { assigneeId: null } }),
      prisma.siteVisit.updateMany({ where: { assignedToId: target.id }, data: { assignedToId: null } }),
      prisma.project.updateMany({ where: { projectManagerId: target.id }, data: { projectManagerId: null } }),
      prisma.user.delete({ where: { id: target.id } }),
    ]);
  }
  await prisma.activityLog.create({ data: { userId: me.id, action: "EMPLOYEE_DELETED", entityType: "User", entityId: target.id, metadata: { name: target.name, kept: hasHistory } } });
  return NextResponse.json({
    ok: true,
    message: hasHistory ? `${target.name} was removed. Their past quotations and activity are kept for records.` : `${target.name} was deleted.`,
  });
}
