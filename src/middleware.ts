import { withAuth } from "next-auth/middleware";

// Send signed-out visitors (including expired sessions opening a PDF link) to our own login page.
export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  // Protect everything except login, NextAuth, public share links, the Android verification file,
  // the service worker / offline page and static assets.
  matcher: ["/((?!login|api/auth|share/|\.well-known|sw\.js|offline\.html|_next/static|_next/image|favicon.ico|manifest.json|icon.svg|icons).*)"],
};
