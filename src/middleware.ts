export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except login, NextAuth, public share links, the Android verification file,
  // the service worker / offline page and static assets.
  matcher: ["/((?!login|api/auth|share/|\.well-known|sw\.js|offline\.html|_next/static|_next/image|favicon.ico|manifest.json|icon.svg|icons).*)"],
};
