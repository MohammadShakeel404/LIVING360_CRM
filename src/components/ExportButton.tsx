"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function ExportButton({ endpoint, label = "Export" }: { endpoint: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? "living360-export.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong exporting this list.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-[10px] border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-ink disabled:opacity-60"
      >
        {loading ? <Loader2 size={15} className="animate-spin text-primary" /> : <Download size={15} className="text-primary" />}
        {loading ? "Preparing…" : label}
      </button>
      {error && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-56 rounded-lg border border-danger/30 bg-danger-bg p-2.5 text-[12px] font-medium text-danger shadow-lg z-10">
          {error}
        </div>
      )}
    </div>
  );
}
