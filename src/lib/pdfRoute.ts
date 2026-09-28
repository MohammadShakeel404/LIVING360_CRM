import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, type Module } from "@/lib/permissions";
import { pdfResponseHeaders } from "@/lib/pdf";

/** GET handler for an authenticated PDF that needs view + financial access to a module. */
export function pdfRoute(module: Module, render: (id: string) => Promise<{ buffer: Buffer; filename: string } | null>) {
  return async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!can(session.user.role, module, "view") || !can(session.user.role, module, "financial")) {
      return NextResponse.json({ error: "You don't have permission to download this document." }, { status: 403 });
    }
    const pdf = await render(params.id);
    if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(pdf.buffer as any, { headers: pdfResponseHeaders(pdf.filename, req.nextUrl.searchParams.get("inline") === "1") });
  };
}
