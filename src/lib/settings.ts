import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export async function getCompanySettings() {
  return (
    (await prisma.companySettings.findUnique({ where: { id: "default" } })) ??
    (await prisma.companySettings.create({ data: { id: "default" } }))
  );
}
export type CompanySettingsRow = Awaited<ReturnType<typeof getCompanySettings>>;

// ---- Public share links for PDFs ------------------------------------------
// ponytail: stateless HMAC links — no per-link revocation; rotate NEXTAUTH_SECRET to revoke all.

export type ShareKind = "quotation" | "invoice" | "agreement" | "workorder" | "cos" | "wreceipt";
export const SHARE_KINDS: ShareKind[] = ["quotation", "invoice", "agreement", "workorder", "cos", "wreceipt"];

function sign(kind: ShareKind, id: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("NEXTAUTH_SECRET must be set in production.");
  return createHmac("sha256", secret ?? "dev-secret").update(`${kind}:${id}`).digest("base64url").slice(0, 32);
}

export function shareToken(kind: ShareKind, id: string) {
  return sign(kind, id);
}

export function verifyShareToken(kind: ShareKind, id: string, token: string | null) {
  if (!token) return false;
  const a = Buffer.from(sign(kind, id));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Path of the public PDF (no login needed); prefix with window.location.origin on the client. */
export function sharePath(kind: ShareKind, id: string) {
  return `/share/${kind}/${id}?t=${shareToken(kind, id)}`;
}
