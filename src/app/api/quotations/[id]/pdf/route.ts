import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { quotationPdf } from "@/lib/documentPdf";
import { pdfResponseHeaders } from "@/lib/pdf";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  // The PDF shows prices, so it needs financial access, not just view.
  if (!can(role, "quotations", "view") || !can(role, "quotations", "financial")) {
    return NextResponse.json({ error: "You don't have permission to download quotation PDFs." }, { status: 403 });
  }
  if (role === "SALES_EXECUTIVE") {
    const own = await prisma.quotation.count({ where: { id: params.id, salespersonId: session.user.id } });
    if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await quotationPdf(params.id);
  if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(pdf.buffer as any, { headers: pdfResponseHeaders(pdf.filename, inline) });
}

// PDF rendering + a cold database can exceed the 10 s default on Vercel.
export const maxDuration = 60;
