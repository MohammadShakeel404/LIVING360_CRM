import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const opt = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v === undefined ? undefined : v || null));
const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  email: opt(120).refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "Enter a valid email"),
  address: opt(400),
  gstin: opt(15).transform((v) => (v ? v.toUpperCase() : v)),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "clients", "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 422 });
  const exists = await prisma.client.count({ where: { id: params.id } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const client = await prisma.client.update({ where: { id: params.id }, data: parsed.data });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "CLIENT_UPDATED", entityType: "Client", entityId: client.id } });
  return NextResponse.json({ client, message: "Client updated." });
}
