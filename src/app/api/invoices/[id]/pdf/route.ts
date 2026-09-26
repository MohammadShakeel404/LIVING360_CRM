import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { invoicePdf } from "@/lib/documentPdf";
import { pdfResponseHeaders } from "@/lib/pdf";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (!can(role, "invoices", "view") || !can(role, "invoices", "financial")) {
    return NextResponse.json({ error: "You don't have permission to download invoice PDFs." }, { status: 403 });
  }

  const pdf = await invoicePdf(params.id);
  if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(pdf.buffer as any, { headers: pdfResponseHeaders(pdf.filename, inline) });
}
