import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Turbopack (Next.js 16) ────────────────────────────────────────────────
  // Enable via CLI: `next dev --turbo`  (or `next dev` for webpack)
  turbopack: {},

  // ── React Compiler (top-level in Next.js 16) ──────────────────────────────
  reactCompiler: true,

  // ── Experimental ──────────────────────────────────────────────────────────
  experimental: {
    // Package-level tree-shaking for large icon libs and heavy Radix primitives.
    // Reduces JS sent to the browser without any code changes.
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "framer-motion",
      "recharts",
      "date-fns",
    ],
  },

  // ── Server-side only packages (never bundle into client JS) ────────────────
  serverExternalPackages: ["@react-pdf/renderer", "ioredis", "bullmq"],

  // ── Image optimization ─────────────────────────────────────────────────────
  images: {
    formats:          ["image/avif", "image/webp"],
    minimumCacheTTL:  3600,
    deviceSizes:      [640, 750, 828, 1080, 1200, 1920],
    imageSizes:       [16, 32, 48, 64, 96, 128, 256],
  },

  // ── Security + Cache-Control headers ──────────────────────────────────────
  async headers() {
    return [
      // Static assets: cache 1 year (content-hash in filename ensures busting)
      {
        source:  "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Generated PDFs — cache 1 hour, stale-while-revalidate 1 day
      {
        source:  "/invoices/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
      // Fonts: 1 year
      {
        source:  "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // API routes: no public caching (auth-gated)
      {
        source:  "/api/:path*",
        headers: [
          { key: "Cache-Control",         value: "no-store" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options",        value: "DENY" },
        ],
      },
      // All pages: security headers
      {
        source:  "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control",    value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
