"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/** Friendly fallback for unexpected errors inside the app shell (sidebar and nav stay usable). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-bg">
        <AlertTriangle size={24} className="text-danger" />
      </div>
      <div className="mb-1 text-[16px] font-semibold text-ink">Something went wrong</div>
      <div className="mb-5 max-w-[320px] text-[13.5px] text-ink-soft">
        This page couldn&apos;t load. Please try again — if it keeps happening, share this code with your admin: {error.digest ?? "n/a"}
      </div>
      <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-white">
        <RotateCcw size={15} /> Try again
      </button>
    </div>
  );
}
