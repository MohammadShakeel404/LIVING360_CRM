import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCompanySettings } from "@/lib/settings";
import { renderPdf, pdfResponseHeaders } from "@/lib/pdf";
import { quotationTotals, lineNet, amountInWords } from "@/lib/totals";

/** Renders a sample quotation with the saved letterhead so admins can check the layout. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "settings", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const co = await getCompanySettings();
  const items = [
    { group: "Living Room", title: "TV unit with back panel", sub: "Plywood carcass, laminate finish, soft-close drawers", quantity: 42, unit: "Sq.ft", rate: 1850, discountPct: 0, gstPct: 18 },
    { group: "Living Room", title: "False ceiling with cove lighting", quantity: 220, unit: "Sq.ft", rate: 145, discountPct: 0, gstPct: 18 },
    { group: "Kitchen", title: "Modular kitchen — L-shape", sub: "BWP ply, acrylic shutters, Hettich hardware", quantity: 1, unit: "Set", rate: 285000, discountPct: 5, gstPct: 18 },
  ];
  const t = quotationTotals(items, 0);
  const buffer = await renderPdf(
    {
      heading: "QUOTATION",
      meta: [["Quotation no.", "QT-SAMPLE"], ["Date", new Date().toLocaleDateString("en-IN")], ["Valid until", "—"]],
      billTo: { label: "Prepared for", name: "Sample Client", lines: ["Whitefield, Bengaluru", "+91 98450 00000"] },
      side: { label: "Prepared by", lines: [session.user.name ?? "Living 360"] },
      showDiscount: true,
      showHsn: false,
      rows: items.map((i) => ({ group: i.group, title: i.title, sub: i.sub, qty: String(i.quantity), unit: i.unit, rate: i.rate, discPct: i.discountPct, gstPct: i.gstPct, amount: lineNet(i) })),
      totals: [
        { label: "Taxable value", value: t.taxable },
        { label: "GST", value: t.gst },
        { label: "Grand total", value: t.grandTotal, strong: true },
      ],
      amountWords: amountInWords(t.grandTotal),
      terms: co.quotationTerms ?? "50% advance to confirm the order.\nBalance on completion.",
      showBank: true,
      watermark: "SAMPLE",
    },
    co
  );
  return new NextResponse(buffer as any, { headers: pdfResponseHeaders("letterhead-preview.pdf", true) });
}
