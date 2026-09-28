"use client";

import { useState } from "react";
import { Building2, FileImage, Landmark, PenLine, ScrollText, Eye, Save, Loader2, Check, FileSignature } from "lucide-react";
import { Card, Field, PageHeader, inputCls, btn } from "@/components/ui";
import { ImageUpload } from "@/components/ImageUpload";
import { MilestoneEditor, fromDrafts, type MilestoneDraft } from "@/components/MilestoneEditor";
import { toDrafts, DEFAULT_AGREEMENT_TERMS, DEFAULT_WORK_ORDER_TERMS } from "@/lib/contracts";
import { toast } from "@/components/toast";

type Settings = {
  companyName: string; tagline: string | null; address: string | null; phone: string | null; email: string | null;
  website: string | null; gstin: string | null; pan: string | null; logo: string | null; headerImage: string | null;
  footerImage: string | null; footerText: string | null; bankName: string | null; accountName: string | null;
  accountNumber: string | null; ifsc: string | null; branch: string | null; upiId: string | null;
  signatoryName: string | null; signatoryTitle: string | null; signature: string | null;
  quotationTerms: string | null; invoiceTerms: string | null; quotationValidityDays: number;
  agreementTerms: string | null; workOrderTerms: string | null; paymentSchedule: MilestoneDraft[];
};

const SECTIONS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "letterhead", label: "Letterhead", icon: FileImage },
  { id: "bank", label: "Bank & payment", icon: Landmark },
  { id: "signature", label: "Signature", icon: PenLine },
  { id: "defaults", label: "Terms & defaults", icon: ScrollText },
  { id: "agreements", label: "Agreements", icon: FileSignature },
];

export function SettingsClient({ initial, canEdit }: { initial: Settings; canEdit: boolean }) {
  const [s, setS] = useState<Settings>(initial);
  const [saved, setSaved] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"designed" | "upload">(initial.headerImage ? "upload" : "designed");
  const dirty = JSON.stringify(s) !== JSON.stringify(saved) || (mode === "designed" && !!s.headerImage);

  const text = (k: keyof Settings) => ({
    value: (s[k] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS((p) => ({ ...p, [k]: e.target.value })),
    disabled: !canEdit,
    className: inputCls,
  });
  const img = (k: keyof Settings) => ({ value: s[k] as string | null, onChange: (v: string | null) => setS((p) => ({ ...p, [k]: v })), disabled: !canEdit });

  async function save() {
    setSaving(true);
    try {
      const sum = s.paymentSchedule.reduce((a, m) => a + (Number(m.pct) || 0), 0);
      if (s.paymentSchedule.some((m) => !m.label.trim()) || Math.abs(sum - 100) > 0.01) throw new Error("Default payment milestones need a description each and must add up to 100%.");
      const base = { ...s, paymentSchedule: fromDrafts(s.paymentSchedule) };
      const body = mode === "designed" ? { ...base, headerImage: null, footerImage: null } : base;
      if (mode === "upload" && !body.headerImage) throw new Error("Upload your letterhead header image, or switch to the designed letterhead.");
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save settings.");
      const { updatedAt, id, ...rest } = data.settings;
      const next = { ...rest, paymentSchedule: toDrafts(rest.paymentSchedule) };
      setS(next);
      setSaved(next);
      toast("Settings saved — new PDFs will use them.");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <PageHeader
        title="Settings"
        subtitle="Letterhead, company and payment details printed on every quotation and invoice."
        actions={
          <a href="/api/settings/preview" target="_blank" rel="noreferrer" className={btn.secondary}>
            <Eye size={15} /> Preview PDF
          </a>
        }
      />
      {!canEdit && (
        <div className="rounded-xl2 bg-warning-bg px-4 py-3 text-[13px] font-medium text-warning">You can view these settings, but only a Super Admin or Admin can change them.</div>
      )}

      <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-2 flex flex-col gap-1">
            {SECTIONS.map((x) => (
              <a key={x.id} href={`#${x.id}`} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-medium text-ink-soft hover:bg-white hover:text-primary">
                <x.icon size={16} /> {x.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          <section id="company" className="scroll-mt-4">
            <Card title="Company details" subtitle="Shown in the letterhead and document footers.">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Company name *"><input {...text("companyName")} /></Field>
                <Field label="Tagline"><input {...text("tagline")} placeholder="Interior Design & Execution" /></Field>
                <Field label="Address" className="md:col-span-2"><textarea {...text("address")} rows={2} className={inputCls + " resize-none"} placeholder="Office address" /></Field>
                <Field label="Phone"><input {...text("phone")} placeholder="+91 ..." /></Field>
                <Field label="Email"><input {...text("email")} type="email" placeholder="hello@living360.in" /></Field>
                <Field label="Website"><input {...text("website")} placeholder="www.living360.in" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="GSTIN"><input {...text("gstin")} className={inputCls + " uppercase"} maxLength={15} /></Field>
                  <Field label="PAN"><input {...text("pan")} className={inputCls + " uppercase"} maxLength={10} /></Field>
                </div>
              </div>
            </Card>
          </section>

          <section id="letterhead" className="scroll-mt-4">
            <Card title="Letterhead" subtitle="Used at the top and bottom of every quotation and invoice PDF.">
              <div className="mb-4 inline-flex rounded-[10px] bg-line-soft p-1">
                {([["designed", "Design from company details"], ["upload", "Upload my letterhead"]] as const).map(([id, label]) => (
                  <button
                    key={id} type="button" disabled={!canEdit} onClick={() => setMode(id)}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${mode === id ? "bg-white text-primary shadow-sm" : "text-ink-soft"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="flex flex-col gap-4">
                  {mode === "designed" ? (
                    <>
                      <ImageUpload label="Logo" hint="PNG with transparent background works best." previewClass="h-14" maxWidth={600} {...img("logo")} />
                      <Field label="Footer line" hint="Defaults to company name + website.">
                        <input {...text("footerText")} placeholder="Thank you for choosing Living 360" />
                      </Field>
                    </>
                  ) : (
                    <>
                      <ImageUpload
                        label="Letterhead header image *" previewClass="h-16" maxWidth={2000} {...img("headerImage")}
                        hint="A full-width strip (e.g. 2480 × 400 px) exported from your letterhead design. It's placed edge-to-edge at the top of every page."
                      />
                      <ImageUpload label="Letterhead footer image (optional)" previewClass="h-12" maxWidth={2000} {...img("footerImage")} hint="Full-width strip shown at the bottom of every page." />
                      {!s.footerImage && (
                        <Field label="Footer line (used when no footer image)"><input {...text("footerText")} /></Field>
                      )}
                    </>
                  )}
                </div>
                <LetterheadPreview s={s} mode={mode} />
              </div>
            </Card>
          </section>

          <section id="bank" className="scroll-mt-4">
            <Card title="Bank & payment details" subtitle="Printed in the payment box so clients know where to pay.">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Bank name"><input {...text("bankName")} /></Field>
                <Field label="Branch"><input {...text("branch")} /></Field>
                <Field label="Account name"><input {...text("accountName")} /></Field>
                <Field label="Account number"><input {...text("accountNumber")} inputMode="numeric" /></Field>
                <Field label="IFSC"><input {...text("ifsc")} className={inputCls + " uppercase"} /></Field>
                <Field label="UPI ID"><input {...text("upiId")} placeholder="living360@okbank" /></Field>
              </div>
            </Card>
          </section>

          <section id="signature" className="scroll-mt-4">
            <Card title="Authorised signatory" subtitle="Appears in the signature block of every document.">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Signatory name"><input {...text("signatoryName")} /></Field>
                <Field label="Designation"><input {...text("signatoryTitle")} placeholder="Director" /></Field>
                <div className="md:col-span-2">
                  <ImageUpload label="Signature / stamp" hint="Scan or photo of the signature on white paper, or a transparent PNG." previewClass="h-14" maxWidth={600} {...img("signature")} />
                </div>
              </div>
            </Card>
          </section>

          <section id="defaults" className="scroll-mt-4">
            <Card title="Terms & defaults">
              <div className="grid gap-3">
                <Field label="Quotation validity (days)" className="max-w-[220px]">
                  <input
                    type="number" min={1} max={365} disabled={!canEdit} className={inputCls}
                    value={s.quotationValidityDays}
                    onChange={(e) => setS((p) => ({ ...p, quotationValidityDays: Number(e.target.value) || 1 }))}
                  />
                </Field>
                <Field label="Default quotation terms" hint="One point per line. Pre-filled on new quotations; editable per quotation.">
                  <textarea {...text("quotationTerms")} rows={5} className={inputCls + " resize-y"} placeholder={"50% advance to confirm the order.\n40% on material delivery, 10% on handover.\nPrices valid for 15 days."} />
                </Field>
                <Field label="Invoice terms" hint="Printed on every invoice.">
                  <textarea {...text("invoiceTerms")} rows={4} className={inputCls + " resize-y"} placeholder={"Payment due within 7 days.\nInterest @18% p.a. on delayed payments."} />
                </Field>
              </div>
            </Card>
          </section>

          <section id="agreements" className="scroll-mt-4">
            <Card title="Agreements & work orders" subtitle="Defaults for new project agreements. Each agreement can still be edited.">
              <div className="grid gap-4">
                <Field label="Default payment schedule">
                  <MilestoneEditor disabled={!canEdit} value={s.paymentSchedule} onChange={(paymentSchedule) => setS((p) => ({ ...p, paymentSchedule }))} />
                </Field>
                <Field label="Agreement terms" hint="One clause per line — printed as numbered clauses. Have your legal advisor review these once.">
                  <textarea {...text("agreementTerms")} rows={9} className={inputCls + " resize-y text-[13.5px]"} placeholder={DEFAULT_AGREEMENT_TERMS} />
                </Field>
                <Field label="Work order terms" hint="Printed on every work order.">
                  <textarea {...text("workOrderTerms")} rows={4} className={inputCls + " resize-y"} placeholder={DEFAULT_WORK_ORDER_TERMS} />
                </Field>
              </div>
            </Card>
          </section>
        </div>
      </div>

      {canEdit && (
        <div className={`fixed inset-x-0 bottom-16 z-30 px-4 transition-all md:bottom-4 md:left-auto md:right-6 md:px-0 ${dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl2 bg-dark px-4 py-3 shadow-2xl">
            <span className="text-[13px] font-medium text-white/85">You have unsaved changes</span>
            <div className="flex gap-2">
              <button onClick={() => { setS(saved); setMode(saved.headerImage ? "upload" : "designed"); }} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white/70 hover:text-white">Discard</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-bold text-dark disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
      {canEdit && !dirty && (
        <div className="flex items-center gap-1.5 text-[12.5px] text-ink-faint"><Check size={14} className="text-success" /> All changes saved</div>
      )}
    </div>
  );
}

/** Scaled-down HTML mock of the PDF page so admins see roughly what they'll get before saving. */
function LetterheadPreview({ s, mode }: { s: Settings; mode: "designed" | "upload" }) {
  const contact = [s.address, [s.phone, s.email].filter(Boolean).join(" · "), s.website].filter(Boolean);
  return (
    <div>
      <div className="mb-1.5 text-[12.5px] font-medium text-ink-soft">Preview</div>
      <div className="mx-auto flex aspect-[1/1.414] w-full max-w-[360px] flex-col overflow-hidden rounded-md bg-white shadow-[0_6px_24px_rgba(37,26,81,0.14)] ring-1 ring-line">
        {mode === "upload" && s.headerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.headerImage} alt="Letterhead header" className="w-full" />
        ) : mode === "upload" ? (
          <div className="flex h-14 items-center justify-center bg-line-soft text-[10px] text-ink-faint">Your header image goes here</div>
        ) : (
          <div>
            <div className="h-1 bg-primary" />
            <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
              <div className="flex min-w-0 items-center gap-2">
                {s.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo} alt="Logo" className="h-7 max-w-[70px] object-contain" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gold text-[13px] font-bold text-dark">{s.companyName.charAt(0)}</div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-bold text-dark">{s.companyName || "Company"}</div>
                  {s.tagline && <div className="truncate text-[7px] text-primary">{s.tagline}</div>}
                </div>
              </div>
              <div className="text-right text-[6px] leading-tight text-ink-soft">
                {contact.map((l, i) => <div key={i} className="max-w-[140px] truncate">{l}</div>)}
                {(s.gstin || s.pan) && <div className="font-semibold text-ink">{[s.gstin && `GSTIN: ${s.gstin}`, s.pan && `PAN: ${s.pan}`].filter(Boolean).join("  ")}</div>}
              </div>
            </div>
            <div className="mx-4 flex"><div className="h-px flex-1 bg-dark" /><div className="h-px w-10 bg-gold" /></div>
          </div>
        )}

        <div className="flex-1 px-4 py-3">
          <div className="text-[11px] font-bold tracking-[0.15em] text-primary">QUOTATION</div>
          <div className="mt-0.5 h-0.5 w-5 bg-gold" />
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-2/5 rounded bg-line-soft" />
            <div className="h-2 w-1/3 rounded bg-line-soft" />
          </div>
          <div className="mt-3 h-3 rounded-sm bg-dark" />
          {[0, 1, 2, 3].map((i) => <div key={i} className="mt-1 h-2.5 rounded-sm bg-line-soft/70" />)}
          <div className="ml-auto mt-3 h-3.5 w-2/5 rounded-sm bg-primary" />
        </div>

        {mode === "upload" && s.footerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.footerImage} alt="Letterhead footer" className="w-full" />
        ) : (
          <div className="mx-4 mb-2 flex justify-between border-t border-line pt-1 text-[6px] text-ink-faint">
            <span className="truncate">{s.footerText || `${s.companyName}${s.website ? " · " + s.website : ""}`}</span>
            <span>Page 1 of 1</span>
          </div>
        )}
      </div>
    </div>
  );
}
