import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "origin-when-cross-origin",
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  // Our own R2 files are loaded directly by the browser; only third-party
  // media goes through /api/media-proxy (whose responses Vercel caps ~4.5 MB).
  env: {
    NEXT_PUBLIC_R2_PUBLIC_DOMAIN_URL: process.env.R2_PUBLIC_DOMAIN_URL ?? "",
  },
  // Pin the workspace root explicitly. Without this, Turbopack walks up looking
  // for a lockfile and picks up unrelated projects that happen to sit above this
  // directory, which both warns on every build and makes resolution depend on
  // the machine's layout.
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
