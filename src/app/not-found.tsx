import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-[44px] font-bold text-primary">404</div>
      <div className="mb-1 text-[16px] font-semibold text-ink">We couldn&apos;t find that page</div>
      <div className="mb-5 max-w-[320px] text-[13.5px] text-ink-soft">It may have been deleted, or you may not have access to it.</div>
      <Link href="/dashboard" className="rounded-[10px] bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-white">Back to dashboard</Link>
    </div>
  );
}
