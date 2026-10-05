import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/settings";
import { renderPdf, type PdfDoc } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SAMPLE: PdfDoc = {
  heading: "HEALTH CHECK", meta: [["Check", "OK"]], billTo: { label: "Test", name: "Test", lines: [] },
  showDiscount: false, showHsn: false, rows: [], totals: [{ label: "Total", value: 1, strong: true }],
  amountWords: "Rupees One Only", showBank: false,
};

async function step<T>(fn: () => Promise<T>) {
  const t = Date.now();
  try {
    const result = await fn();
    return { ok: true, ms: Date.now() - t, result };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - t, error: String(e?.message ?? e).slice(0, 500), stack: String(e?.stack ?? "").split("\n").slice(1, 4).join(" | ") };
  }
}

/**
 * Deployment self-test: env present, database reachable, PDF fonts on disk, PDF engine working.
 * Returns only booleans, timings and error messages — no secrets or business data.
 */
export async function GET() {
  const fontDir = path.join(process.cwd(), "src/assets/fonts");
  const env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
  };
  const fonts = ["Afacad-Regular.ttf", "Afacad-SemiBold.ttf", "Afacad-Bold.ttf"].map((f) => ({ f, exists: fs.existsSync(path.join(fontDir, f)) }));
  const db = await step(async () => (await prisma.$queryRaw<{ n: number }[]>`SELECT 1 AS n`)[0]?.n === 1);
  const settings = await step(async () => {
    const s = await getCompanySettings();
    return { logoKB: s.logo ? Math.round(s.logo.length / 1024) : 0, headerKB: s.headerImage ? Math.round(s.headerImage.length / 1024) : 0, footerKB: s.footerImage ? Math.round(s.footerImage.length / 1024) : 0, signatureKB: s.signature ? Math.round(s.signature.length / 1024) : 0 };
  });
  const plainPdf = await step(async () => {
    const co = { ...(await getCompanySettings()), logo: null, headerImage: null, footerImage: null, signature: null };
    return { bytes: (await renderPdf(SAMPLE, co)).length };
  });
  const letterheadPdf = await step(async () => ({ bytes: (await renderPdf(SAMPLE, await getCompanySettings())).length }));

  const ok = env.DATABASE_URL && env.NEXTAUTH_SECRET && fonts.every((f) => f.exists) && db.ok && plainPdf.ok && letterheadPdf.ok;
  return NextResponse.json(
    { ok, cwd: process.cwd(), node: process.version, region: process.env.VERCEL_REGION ?? null, env, fonts, db, settings, plainPdf, letterheadPdf },
    { status: ok ? 200 : 500, headers: { "Cache-Control": "no-store" } }
  );
}
