"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; text: string; tone: Tone };

let listener: ((t: Toast) => void) | null = null;
let seq = 0;

/** Fire-and-forget notification, callable from any client component. */
export function toast(text: string, tone: Tone = "success") {
  listener?.({ id: ++seq, text, tone });
}

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info };
const CLS = { success: "text-success", error: "text-danger", info: "text-gold" };

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    listener = (t) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 3600);
    };
    return () => { listener = null; };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6">
      {items.map((t) => {
        const Icon = ICON[t.tone];
        return (
          <div key={t.id} role="status" className="pointer-events-auto flex max-w-sm animate-slideUp items-center gap-2.5 rounded-xl2 bg-dark px-4 py-3 text-[13.5px] font-medium text-white shadow-2xl">
            <Icon size={17} className={CLS[t.tone]} />
            {t.text}
          </div>
        );
      })}
    </div>
  );
}
