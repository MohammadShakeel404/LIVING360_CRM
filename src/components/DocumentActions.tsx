"use client";

import { useEffect, useState } from "react";
import { Download, Eye, Share2, MessageCircle, Mail, Link2, Loader2, ChevronDown } from "lucide-react";
import { btn } from "@/components/ui";
import { toast } from "@/components/toast";

async function fetchPdf(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Couldn't generate the PDF (${res.status}).`);
  }
  return res.blob();
}

/**
 * Download / preview / share buttons for a quotation or invoice PDF.
 * Sharing uses the native share sheet (sends the actual PDF file on phones), with WhatsApp,
 * email and a copyable public link as fallbacks that work everywhere.
 */
export function DocumentActions({
  pdfUrl, sharePath, filename, title, recipientName, phone, email, shareDisabledReason, onShared,
}: {
  pdfUrl: string;
  sharePath: string;
  filename: string;
  title: string;
  recipientName?: string | null;
  phone?: string | null;
  email?: string | null;
  shareDisabledReason?: string | null;
  onShared?: () => void;
}) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!(e.target as Element).closest?.("[data-share-menu]")) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const link = origin + sharePath;
  const greeting = `Hello${recipientName ? " " + recipientName.split(" ")[0] : ""},\n\nPlease find your ${title} from Living 360 here:\n${link}\n\nThank you!`;

  async function download() {
    setBusy("download");
    try {
      const blob = await fetchPdf(pdfUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function nativeShare() {
    setBusy("share");
    try {
      const file = new File([await fetchPdf(pdfUrl)], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: `${title} from Living 360` });
        onShared?.();
      } else {
        setOpen(true);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast(e.message ?? "Sharing failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  function after(msg: string) {
    setOpen(false);
    toast(msg, "info");
    onShared?.();
  }

  const waNumber = phone?.replace(/\D/g, "");
  const waHref = `https://wa.me/${waNumber && waNumber.length === 10 ? "91" + waNumber : waNumber ?? ""}?text=${encodeURIComponent(greeting)}`;
  const mailHref = `mailto:${email ?? ""}?subject=${encodeURIComponent(`${title} — Living 360`)}&body=${encodeURIComponent(greeting)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={download} disabled={busy !== null} className={btn.secondary}>
        {busy === "download" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download PDF
      </button>
      <a href={`${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}inline=1`} target="_blank" rel="noreferrer" className={btn.secondary}>
        <Eye size={15} /> Preview
      </a>
      <div className="relative" data-share-menu>
        <div className="flex">
          <button
            onClick={nativeShare}
            disabled={busy !== null || !!shareDisabledReason}
            title={shareDisabledReason ?? "Share the PDF"}
            className={btn.primary + " rounded-r-none"}
          >
            {busy === "share" ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />} Share
          </button>
          <button
            aria-label="More share options"
            disabled={!!shareDisabledReason}
            onClick={() => setOpen((o) => !o)}
            className={btn.primary + " rounded-l-none border-l border-white/20 px-2"}
          >
            <ChevronDown size={15} />
          </button>
        </div>
        {open && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-60 overflow-hidden rounded-xl2 border border-line bg-white shadow-xl">
            <a href={waHref} target="_blank" rel="noreferrer" onClick={() => after("Opening WhatsApp…")} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink hover:bg-appbg">
              <MessageCircle size={16} className="text-[#25D366]" /> WhatsApp {phone ? <span className="ml-auto text-[11.5px] text-ink-faint">{phone}</span> : null}
            </a>
            <a href={mailHref} onClick={() => after("Opening your email app…")} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink hover:bg-appbg">
              <Mail size={16} className="text-primary" /> Email {email ? <span className="ml-auto max-w-[110px] truncate text-[11.5px] text-ink-faint">{email}</span> : null}
            </a>
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(link); after("Link copied — anyone with it can view this PDF."); }
                catch {
                  // Clipboard API needs HTTPS; fall back to the legacy copy command.
                  const ta = Object.assign(document.createElement("textarea"), { value: link });
                  document.body.appendChild(ta);
                  ta.select();
                  const ok = document.execCommand("copy");
                  ta.remove();
                  ok ? after("Link copied — anyone with it can view this PDF.") : toast(link, "info");
                }
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink hover:bg-appbg"
            >
              <Link2 size={16} className="text-ink-soft" /> Copy client link
            </button>
          </div>
        )}
      </div>
      {shareDisabledReason && <span className="text-[12px] font-medium text-warning">{shareDisabledReason}</span>}
    </div>
  );
}
