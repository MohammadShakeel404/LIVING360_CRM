import path from "path";
import { Document, Page, View, Text, Image, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { CompanySettingsRow } from "@/lib/settings";
import { dataUrlImageSize } from "@/lib/imageSize";

const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");
Font.register({
  family: "Afacad",
  fonts: [
    { src: path.join(FONT_DIR, "Afacad-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Afacad-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "Afacad-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

const C = {
  primary: "#523AB7", gold: "#FEB73F", dark: "#251A51", ink: "#1D1730", soft: "#6B6480",
  faint: "#9791AC", line: "#E8E4F2", lineSoft: "#F0EDF7", bg: "#F6F5FB",
};
const PAGE_W = 595.28;
const SIDE = 36;

export type PdfRow = {
  group?: string;
  title: string;
  sub?: string;
  hsn?: string;
  qty: string;
  unit: string;
  rate: number;
  discPct?: number;
  gstPct: number;
  amount: number;
};

export type PdfDoc = {
  heading: string; // "QUOTATION" | "TAX INVOICE"
  meta: [string, string][]; // right-hand meta box
  billTo: { label: string; name: string; lines: string[] };
  side?: { label: string; lines: string[] };
  showDiscount: boolean;
  showHsn: boolean;
  rows: PdfRow[];
  totals: { label: string; value: number; strong?: boolean; negative?: boolean }[];
  amountWords: string;
  notes?: string | null;
  terms?: string | null;
  showBank: boolean;
  watermark?: string | null;
  /** "contract": intro + numbered sections + two-party signatures, items as an annexure on a new page. */
  layout?: "commercial" | "contract";
  intro?: string[];
  sections?: PdfSection[];
  /** Adds a client acceptance signature block. */
  clientSign?: { label: string; name: string };
  itemsTitle?: string;
};

export type PdfSection = {
  title: string;
  paragraphs?: string[];
  /** Render paragraphs as a numbered list. */
  numbered?: boolean;
  table?: { cols: { label: string; w?: number; align?: "left" | "right" }[]; rows: string[][] };
};

export const inr = (v: number) =>
  (v < 0 ? "− ₹" : "₹") + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));

const s = StyleSheet.create({
  page: { fontFamily: "Afacad", fontSize: 9.5, color: C.ink, paddingHorizontal: SIDE },
  row: { flexDirection: "row" },
  small: { fontSize: 8.5, color: C.soft },
  label: { fontSize: 7.5, color: C.faint, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 },
  th: { color: "#FFFFFF", fontWeight: 600, fontSize: 8.5, paddingVertical: 6, paddingHorizontal: 5 },
  td: { paddingVertical: 5.5, paddingHorizontal: 5, fontSize: 9 },
});

function imageBox(src: string | null | undefined, maxH: number) {
  if (!src) return null;
  const dim = dataUrlImageSize(src);
  if (!dim) return null;
  return { src, height: Math.min((PAGE_W * dim.height) / dim.width, maxH) };
}

function Header({ co }: { co: CompanySettingsRow }) {
  const contact = [co.address, [co.phone, co.email].filter(Boolean).join("  ·  "), co.website].filter(Boolean) as string[];
  const ids = [co.gstin && `GSTIN: ${co.gstin}`, co.pan && `PAN: ${co.pan}`].filter(Boolean).join("   ");
  return (
    <View fixed style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
      <View style={{ height: 6, backgroundColor: C.primary }} />
      <View style={[s.row, { paddingHorizontal: SIDE, paddingTop: 16, paddingBottom: 12, alignItems: "center" }]}>
        <View style={[s.row, { flex: 1, alignItems: "center" }]}>
          {co.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={co.logo} style={{ maxHeight: 52, maxWidth: 120, marginRight: 12, objectFit: "contain" }} />
          ) : (
            <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: C.gold, marginRight: 12, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22, fontWeight: 700, color: C.dark }}>{co.companyName.charAt(0)}</Text>
            </View>
          )}
          <View>
            <Text style={{ fontSize: 18, fontWeight: 700, color: C.dark }}>{co.companyName}</Text>
            {co.tagline && <Text style={{ fontSize: 9, color: C.primary, marginTop: 1 }}>{co.tagline}</Text>}
          </View>
        </View>
        <View style={{ width: 230, alignItems: "flex-end" }}>
          {contact.map((l, i) => (
            <Text key={i} style={{ fontSize: 8.5, color: C.soft, textAlign: "right", marginBottom: 1.5 }}>{l}</Text>
          ))}
          {ids && <Text style={{ fontSize: 8.5, color: C.ink, fontWeight: 600, textAlign: "right", marginTop: 1 }}>{ids}</Text>}
        </View>
      </View>
      <View style={[s.row, { marginHorizontal: SIDE }]}>
        <View style={{ flex: 1, height: 1.5, backgroundColor: C.dark }} />
        <View style={{ width: 80, height: 1.5, backgroundColor: C.gold }} />
      </View>
    </View>
  );
}
const GENERATED_HEADER_H = 100;
const GENERATED_FOOTER_H = 44;

function Footer({ co, img }: { co: CompanySettingsRow; img: ReturnType<typeof imageBox> }) {
  return (
    <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
      {img ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={img.src} style={{ width: PAGE_W, height: img.height }} />
      ) : (
        <View style={{ paddingHorizontal: SIDE, paddingBottom: 14 }}>
          <View style={{ height: 0.8, backgroundColor: C.line, marginBottom: 6 }} />
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={{ fontSize: 8, color: C.faint, flex: 1 }}>{co.footerText ?? `${co.companyName}${co.website ? " · " + co.website : ""}`}</Text>
            <Text style={{ fontSize: 8, color: C.faint }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </View>
      )}
    </View>
  );
}

function ItemsTable({ doc }: { doc: PdfDoc }) {
  const cols = [
    { key: "#", w: 22, align: "left" as const },
    { key: "Description", flex: 1, align: "left" as const },
    ...(doc.showHsn ? [{ key: "HSN/SAC", w: 50, align: "left" as const }] : []),
    { key: "Qty", w: 58, align: "right" as const },
    { key: "Rate", w: 70, align: "right" as const },
    ...(doc.showDiscount ? [{ key: "Disc", w: 34, align: "right" as const }] : []),
    { key: "GST", w: 32, align: "right" as const },
    { key: "Amount", w: 78, align: "right" as const },
  ];
  const cell = (i: number) => ({ width: cols[i].w, flex: cols[i].flex, textAlign: cols[i].align });

  let lastGroup: string | undefined;
  let idx = 0;
  return (
    <View style={{ marginTop: 14 }}>
      <View fixed style={[s.row, { backgroundColor: C.dark, borderTopLeftRadius: 4, borderTopRightRadius: 4 }]}>
        {cols.map((c, i) => <Text key={c.key} style={[s.th, cell(i)]}>{c.key}</Text>)}
      </View>
      {doc.rows.map((r, ri) => {
        const groupRow = r.group && r.group !== lastGroup;
        lastGroup = r.group;
        idx++;
        const vals = [
          String(idx),
          null,
          ...(doc.showHsn ? [r.hsn ?? ""] : []),
          `${r.qty} ${r.unit}`,
          inr(r.rate),
          ...(doc.showDiscount ? [r.discPct ? `${r.discPct}%` : "—"] : []),
          `${r.gstPct}%`,
          inr(r.amount),
        ];
        return (
          <View key={ri} wrap={false}>
            {groupRow && (
              <View style={{ backgroundColor: C.lineSoft, paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.6, borderBottomColor: C.line }}>
                <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.primary, letterSpacing: 0.6, textTransform: "uppercase" }}>{r.group}</Text>
              </View>
            )}
            <View style={[s.row, { borderBottomWidth: 0.6, borderBottomColor: C.line, backgroundColor: idx % 2 === 0 ? "#FBFAFE" : "#FFFFFF" }]}>
              {vals.map((v, i) =>
                v === null ? (
                  <View key={i} style={[s.td, cell(i)]}>
                    <Text style={{ fontWeight: 600 }}>{r.title}</Text>
                    {r.sub && <Text style={[s.small, { marginTop: 1.5 }]}>{r.sub}</Text>}
                  </View>
                ) : (
                  <Text key={i} style={[s.td, cell(i), i === vals.length - 1 ? { fontWeight: 600 } : {}]}>{v}</Text>
                )
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PdfDocument({ doc, co }: { doc: PdfDoc; co: CompanySettingsRow }) {
  const headerImg = imageBox(co.headerImage, 200);
  const footerImg = imageBox(co.footerImage, 140);
  const top = (headerImg?.height ?? GENERATED_HEADER_H) + 18;
  const bottom = (footerImg?.height ?? GENERATED_FOOTER_H) + 16;
  const bankLines = [
    co.bankName && ["Bank", co.bankName + (co.branch ? `, ${co.branch}` : "")],
    co.accountName && ["Account name", co.accountName],
    co.accountNumber && ["Account no.", co.accountNumber],
    co.ifsc && ["IFSC", co.ifsc],
    co.upiId && ["UPI", co.upiId],
  ].filter(Boolean) as [string, string][];

  return (
    <Document title={`${doc.heading} ${doc.meta[0]?.[1] ?? ""}`} author={co.companyName} creator="Living 360">
      <Page size="A4" style={[s.page, { paddingTop: top, paddingBottom: bottom }]}>
        {headerImg ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image fixed src={headerImg.src} style={{ position: "absolute", top: 0, left: 0, width: PAGE_W, height: headerImg.height }} />
        ) : (
          <Header co={co} />
        )}
        <Footer co={co} img={footerImg} />

        {doc.watermark && (
          <Text fixed style={{ position: "absolute", top: 380, left: 90, fontSize: 90, fontWeight: 700, color: C.primary, opacity: 0.06, transform: "rotate(-30deg)" }}>
            {doc.watermark}
          </Text>
        )}

        {/* Title + meta */}
        <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: 700, color: C.primary, letterSpacing: 2 }}>{doc.heading}</Text>
            <View style={{ width: 36, height: 3, backgroundColor: C.gold, marginTop: 4 }} />
          </View>
          <View style={{ backgroundColor: C.bg, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, minWidth: 190 }}>
            {doc.meta.map(([k, v]) => (
              <View key={k} style={[s.row, { justifyContent: "space-between", marginBottom: 2 }]}>
                <Text style={{ fontSize: 8.5, color: C.soft, marginRight: 14 }}>{k}</Text>
                <Text style={{ fontSize: 9, fontWeight: 600 }}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Parties */}
        <View style={[s.row, { marginTop: 14, gap: 12 }]}>
          <View style={{ flex: 1, borderWidth: 0.8, borderColor: C.line, borderRadius: 6, padding: 10 }}>
            <Text style={s.label}>{doc.billTo.label}</Text>
            <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{doc.billTo.name}</Text>
            {doc.billTo.lines.map((l, i) => <Text key={i} style={[s.small, { marginBottom: 1 }]}>{l}</Text>)}
          </View>
          {doc.side && (
            <View style={{ flex: 1, borderWidth: 0.8, borderColor: C.line, borderRadius: 6, padding: 10 }}>
              <Text style={s.label}>{doc.side.label}</Text>
              {doc.side.lines.map((l, i) => <Text key={i} style={[s.small, { marginBottom: 1, color: i === 0 ? C.ink : C.soft, fontWeight: i === 0 ? 600 : 400 }]}>{l}</Text>)}
            </View>
          )}
        </View>

        {doc.layout === "contract" ? (
          <>
            {doc.intro?.map((p, i) => <Text key={i} style={{ fontSize: 9.5, lineHeight: 1.5, marginTop: i ? 6 : 16 }}>{p}</Text>)}
            {doc.sections?.map((sec, i) => <Section key={i} n={i + 1} sec={sec} />)}
            <Signatures doc={doc} co={co} />
            {doc.rows.length > 0 && (
              <View break>
                {doc.itemsTitle && <Text style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 2 }}>{doc.itemsTitle}</Text>}
                <ItemsTable doc={doc} />
                <Totals doc={doc} />
              </View>
            )}
          </>
        ) : (
          <>
            {doc.rows.length > 0 && <ItemsTable doc={doc} />}
            <Totals doc={doc} />
            {doc.sections?.map((sec, i) => <Section key={i} sec={sec} />)}
            {(() => {
              const bank = doc.showBank && bankLines.length > 0 && (
                <View style={{ borderWidth: 0.8, borderColor: C.line, borderRadius: 6, padding: 10 }}>
                  <Text style={s.label}>Payment details</Text>
                  {bankLines.map(([k, v]) => (
                    <View key={k} style={[s.row, { marginBottom: 1.5 }]}>
                      <Text style={[s.small, { width: 72 }]}>{k}</Text>
                      <Text style={{ fontSize: 9, fontWeight: 600 }}>{v}</Text>
                    </View>
                  ))}
                </View>
              );
              // With a client signature: bank box on its own row, then both signatures side by side.
              return doc.clientSign ? (
                <>
                  {bank && <View wrap={false} style={{ marginTop: 14 }}>{bank}</View>}
                  <Terms text={doc.terms} />
                  <Signatures doc={doc} co={co} />
                </>
              ) : (
                <View wrap={false} style={[s.row, { marginTop: 18, gap: 16, alignItems: "flex-end" }]}>
                  <View style={{ flex: 1 }}>{bank}</View>
                  <CompanySign co={co} />
                </View>
              );
            })()}
            {!doc.clientSign && <Terms text={doc.terms} />}
          </>
        )}
      </Page>
    </Document>
  );
}

function Terms({ text }: { text?: string | null }) {
  const lines = (text ?? "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text minPresenceAhead={24} style={s.label}>Terms & conditions</Text>
      {lines.map((l, i) => <Text key={i} style={[s.small, { marginBottom: 2 }]}>{l}</Text>)}
    </View>
  );
}

function Totals({ doc }: { doc: PdfDoc }) {
  if (!doc.totals.length) return null;
  return (
    <View wrap={false} style={[s.row, { marginTop: 12, gap: 16 }]}>
      <View style={{ flex: 1 }}>
        {doc.amountWords ? (
          <>
            <Text style={s.label}>Amount in words</Text>
            <Text style={{ fontSize: 9.5, fontWeight: 600 }}>{doc.amountWords}</Text>
          </>
        ) : null}
        {doc.notes && (
          <View style={{ marginTop: 10 }}>
            <Text style={s.label}>Notes</Text>
            <Text style={s.small}>{doc.notes}</Text>
          </View>
        )}
      </View>
      <View style={{ width: 220 }}>
        {doc.totals.map((t) =>
          t.strong ? (
            <View key={t.label} style={[s.row, { justifyContent: "space-between", backgroundColor: C.primary, borderRadius: 5, paddingVertical: 7, paddingHorizontal: 9, marginTop: 4 }]}>
              <Text style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 11 }}>{t.label}</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 11 }}>{t.negative ? "− " : ""}{inr(t.value)}</Text>
            </View>
          ) : (
            <View key={t.label} style={[s.row, { justifyContent: "space-between", paddingVertical: 2.5, paddingHorizontal: 9 }]}>
              <Text style={{ color: C.soft }}>{t.label}</Text>
              <Text style={{ fontWeight: 600 }}>{t.negative ? "− " : ""}{inr(t.value)}</Text>
            </View>
          )
        )}
      </View>
    </View>
  );
}

function Section({ sec, n }: { sec: PdfSection; n?: number }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text minPresenceAhead={40} style={{ fontSize: 10.5, fontWeight: 700, color: C.dark, marginBottom: 4 }}>{n ? `${n}. ` : ""}{sec.title}</Text>
      {sec.paragraphs?.map((p, i) => (
        <View key={i} wrap={false} style={[s.row, { marginBottom: 3 }]}>
          {sec.numbered && <Text style={{ width: 16, fontSize: 9, color: C.soft }}>{i + 1}.</Text>}
          <Text style={{ flex: 1, fontSize: 9.2, lineHeight: 1.45, color: C.ink }}>{p}</Text>
        </View>
      ))}
      {sec.table && (
        <View style={{ borderWidth: 0.8, borderColor: C.line, borderRadius: 5, marginTop: 2 }}>
          <View style={[s.row, { backgroundColor: C.lineSoft }]}>
            {sec.table.cols.map((c) => <Text key={c.label} style={[s.td, { fontWeight: 600, width: c.w, flex: c.w ? undefined : 1, textAlign: c.align ?? "left" }]}>{c.label}</Text>)}
          </View>
          {sec.table.rows.map((r, ri) => (
            <View key={ri} wrap={false} style={[s.row, { borderTopWidth: 0.6, borderTopColor: C.line }]}>
              {r.map((v, ci) => {
                const c = sec.table!.cols[ci];
                return <Text key={ci} style={[s.td, { width: c.w, flex: c.w ? undefined : 1, textAlign: c.align ?? "left", fontWeight: r[0] === "Total" ? 700 : 400 }]}>{v}</Text>;
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function CompanySign({ co }: { co: CompanySettingsRow }) {
  return (
    <View style={{ width: 200, alignItems: "center" }}>
      <Text style={{ fontSize: 9, color: C.soft, marginBottom: 4 }}>For {co.companyName}</Text>
      {co.signature ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={co.signature} style={{ height: 44, maxWidth: 160, objectFit: "contain" }} />
      ) : (
        <View style={{ height: 44 }} />
      )}
      <View style={{ width: 160, height: 0.8, backgroundColor: C.ink, marginTop: 4, marginBottom: 3 }} />
      <Text style={{ fontSize: 9.5, fontWeight: 600 }}>{co.signatoryName ?? "Authorised Signatory"}</Text>
      {co.signatoryTitle && <Text style={s.small}>{co.signatoryTitle}</Text>}
    </View>
  );
}

function PartySign({ label, name }: { label: string; name: string }) {
  return (
    <View style={{ width: 200, alignItems: "center" }}>
      <Text style={{ fontSize: 9, color: C.soft, marginBottom: 4 }}>{label}</Text>
      <View style={{ height: 44 }} />
      <View style={{ width: 160, height: 0.8, backgroundColor: C.ink, marginTop: 4, marginBottom: 3 }} />
      <Text style={{ fontSize: 9.5, fontWeight: 600 }}>{name}</Text>
      <Text style={s.small}>Date: ____________</Text>
    </View>
  );
}

function Signatures({ doc, co }: { doc: PdfDoc; co: CompanySettingsRow }) {
  return (
    <View wrap={false} style={[s.row, { marginTop: 20, justifyContent: "space-between", alignItems: "flex-start" }]}>
      {doc.clientSign ? <PartySign label={doc.clientSign.label} name={doc.clientSign.name} /> : <View />}
      <CompanySign co={co} />
    </View>
  );
}

export async function renderPdf(doc: PdfDoc, co: CompanySettingsRow) {
  return renderToBuffer(<PdfDocument doc={doc} co={co} />);
}

export function pdfResponseHeaders(filename: string, inline: boolean) {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };
}
