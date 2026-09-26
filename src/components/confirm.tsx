"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { btn, inputCls } from "@/components/ui";

type Ask = {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Show a text field; its value is returned on confirm. */
  input?: { label: string; placeholder?: string };
};
type Pending = Ask & { resolve: (v: string | null) => void };

let open: ((p: Pending) => void) | null = null;

/**
 * In-app replacement for window.confirm / window.prompt (those are blocked in installed PWAs and
 * some embedded browsers). Resolves to null when cancelled, otherwise the input text ("" without input).
 */
export function ask(opts: Ask): Promise<string | null> {
  return new Promise((resolve) => {
    if (!open) return resolve(window.confirm(opts.title) ? "" : null);
    open({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null);
  const [value, setValue] = useState("");
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    open = (next) => { setValue(""); setP(next); };
    return () => { open = null; };
  }, []);
  useEffect(() => {
    if (!p) return;
    if (!p.input) okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p]); // eslint-disable-line react-hooks/exhaustive-deps

  function close(v: string | null) {
    p?.resolve(v);
    setP(null);
  }
  if (!p) return null;
  const Icon = p.danger ? AlertTriangle : HelpCircle;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-4 md:items-center" role="alertdialog" aria-modal="true" aria-label={p.title}>
      <div className="absolute inset-0 bg-ink/45" onClick={() => close(null)} />
      <form
        onSubmit={(e) => { e.preventDefault(); close(value.trim()); }}
        className="relative w-full max-w-[400px] animate-slideUp rounded-[18px] bg-white p-5 shadow-2xl"
      >
        <div className="flex gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${p.danger ? "bg-danger-bg" : "bg-primary/10"}`}>
            <Icon size={19} className={p.danger ? "text-danger" : "text-primary"} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15.5px] font-semibold text-ink">{p.title}</div>
            {p.message && <div className="mt-1 text-[13.5px] text-ink-soft">{p.message}</div>}
          </div>
        </div>
        {p.input && (
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-soft">{p.input.label}</span>
            <input autoFocus className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} placeholder={p.input.placeholder} />
          </label>
        )}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => close(null)} className={btn.secondary + " flex-1 py-2.5"}>Cancel</button>
          <button ref={okRef} type="submit" className={(p.danger ? "inline-flex items-center justify-center rounded-[10px] bg-danger px-3.5 text-[13px] font-semibold text-white" : btn.primary) + " flex-1 py-2.5"}>
            {p.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}
