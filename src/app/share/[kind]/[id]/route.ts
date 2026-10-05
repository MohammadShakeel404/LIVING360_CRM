import { NextRequest, NextResponse } from "next/server";
import { verifyShareToken, SHARE_KINDS, type ShareKind } from "@/lib/settings";
import { quotationPdf, invoicePdf } from "@/lib/documentPdf";
import { agreementPdf, changeOrderPdf } from "@/lib/contractPdf";
import { workerReceiptPdf } from "@/lib/workerPdf";
import { pdfResponseHeaders } from "@/lib/pdf";

const RENDER: Record<ShareKind, (id: string) => Promise<{ buffer: Buffer; filename: string } | null>> = {
  quotation: quotationPdf,
  invoice: invoicePdf,
  agreement: (id) => agreementPdf(id, "agreement"),
  workorder: (id) => agreementPdf(id, "workorder"),
  cos: changeOrderPdf,
  wreceipt: workerReceiptPdf,
};

/** Public, token-protected PDF link that clients can open from WhatsApp / email without logging in. */
export async function GET(req: NextRequest, { params }: { params: { kind: string; id: string } }) {
  const kind = params.kind as ShareKind;
  if (!SHARE_KINDS.includes(kind) || !verifyShareToken(kind, params.id, req.nextUrl.searchParams.get("t"))) {
    return new NextResponse("This link is invalid or has expired.", { status: 404 });
  }
  const pdf = await RENDER[kind](params.id);
  if (!pdf) return new NextResponse("Document not found.", { status: 404 });
  return new NextResponse(pdf.buffer as any, { headers: pdfResponseHeaders(pdf.filename, req.nextUrl.searchParams.get("dl") !== "1") });
}

// PDF rendering + a cold database can exceed the 10 s default on Vercel.
export const maxDuration = 60;
