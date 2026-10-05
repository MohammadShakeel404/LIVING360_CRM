import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { changeOrderPdf } from "@/lib/contractPdf";
import { pdfResponseHeaders } from "@/lib/pdf";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "projects", "view") || !can(session.user.role, "projects", "financial")) {
    return NextResponse.json({ error: "You don't have permission to download this document." }, { status: 403 });
  }
  const pdf = await changeOrderPdf(params.id);
  if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(pdf.buffer as any, { headers: pdfResponseHeaders(pdf.filename, req.nextUrl.searchParams.get("inline") === "1") });
}

// PDF rendering + a cold database can exceed the 10 s default on Vercel.
export const maxDuration = 60;
