import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getCompanySettings } from "@/lib/settings";
import { scheduleSchema } from "@/lib/contracts";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "settings", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ settings: await getCompanySettings() });
}

const text = (max = 300) => z.string().trim().max(max).nullable().optional().transform((v) => v || null);
const image = z
  .string()
  .max(3_000_000, "Image is too large — keep it under 2 MB.")
  .regex(/^data:image\/(png|jpeg);base64,/, "Images must be PNG or JPEG.")
  .nullable()
  .optional();

const schema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(120),
  tagline: text(160), address: text(400), phone: text(60), email: text(120), website: text(120),
  gstin: text(20), pan: text(12),
  logo: image, headerImage: image, footerImage: image, signature: image,
  footerText: text(300),
  bankName: text(), accountName: text(), accountNumber: text(40), ifsc: text(20), branch: text(), upiId: text(80),
  signatoryName: text(100), signatoryTitle: text(100),
  quotationTerms: text(4000), invoiceTerms: text(4000),
  quotationValidityDays: z.number().int().min(1).max(365),
  agreementTerms: text(8000), workOrderTerms: text(4000),
  paymentSchedule: scheduleSchema,
});

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "settings", "edit")) {
    return NextResponse.json({ error: "Only admins can change company settings." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 422 });
  }
  const settings = await prisma.companySettings.upsert({
    where: { id: "default" },
    update: parsed.data,
    create: { id: "default", ...parsed.data },
  });
  await prisma.activityLog.create({
    data: { userId: session.user.id, action: "SETTINGS_UPDATED", entityType: "CompanySettings", entityId: "default" },
  });
  return NextResponse.json({ settings });
}
