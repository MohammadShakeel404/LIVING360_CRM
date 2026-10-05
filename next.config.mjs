/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // react-pdf ships its own React reconciler + fontkit; bundling it breaks font loading.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
    // PDF fonts are read from disk at runtime, so make sure Vercel ships them with every function.
    // pdfkit (inside react-pdf) loads its built-in fonts/data with dynamic paths the tracer can't see.
    outputFileTracingIncludes: {
      "/**": ["./src/assets/fonts/**", "./node_modules/pdfkit/js/standard-fonts/**", "./node_modules/pdfkit/js/data/**"],
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
