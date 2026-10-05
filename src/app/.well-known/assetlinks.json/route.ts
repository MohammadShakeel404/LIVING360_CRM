import { NextResponse } from "next/server";

// Read the env at request time so keys can be added after deploy without a rebuild.
export const dynamic = "force-dynamic";

/**
 * Digital Asset Links: proves to Android that the APK and this website belong together, so the
 * app opens full-screen without a browser address bar. Values come from the APK signing key:
 *   ANDROID_PACKAGE_NAME=in.living360.app
 *   ANDROID_SHA256_FINGERPRINTS=AB:CD:...,12:34:...   (PWABuilder key + Play App Signing key)
 * Fingerprints are pulled out of whatever was pasted (quotes, brackets, spaces, lowercase,
 * even the whole assetlinks.json from PWABuilder), since a single stray character breaks the link.
 */
export function GET() {
  const pkg = (process.env.ANDROID_PACKAGE_NAME ?? "").replace(/["'\s]/g, "");
  const raw = process.env.ANDROID_SHA256_FINGERPRINTS ?? "";
  const fingerprints = [...new Set((raw.match(/([0-9a-f]{2}:){31}[0-9a-f]{2}/gi) ?? []).map((f) => f.toUpperCase()))];
  const body = pkg && fingerprints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fingerprints } }]
    : [];
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
