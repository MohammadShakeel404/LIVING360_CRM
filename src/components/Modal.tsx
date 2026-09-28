"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Modal({
  open, onClose, title, children, footer, wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div onClick={onClose} className="absolute inset-0 bg-ink/45 backdrop-blur-[1px]" />
      <div className={`relative flex max-h-[92dvh] w-full animate-slideUp flex-col rounded-t-[20px] bg-white shadow-2xl md:rounded-[18px] ${wide ? "md:max-w-[720px]" : "md:max-w-[480px]"}`}>
        <div className="px-5 pt-2.5 md:pt-4">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line md:hidden" />
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[16px] font-semibold text-ink">{title}</span>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-ink-soft hover:bg-appbg"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="flex gap-2.5 border-t border-line p-4">{footer}</div>}
      </div>
    </div>
  );
}
