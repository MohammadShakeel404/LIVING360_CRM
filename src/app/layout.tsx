import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Living 360",
  description: "Business management for Living 360 interior design studio",
  manifest: "/manifest.json",
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192" }, { url: "/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Living 360" },
};

export const viewport: Viewport = {
  themeColor: "#251A51",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
