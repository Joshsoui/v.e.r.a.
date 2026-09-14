/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy wordt NIET hier gezet maar in src/middleware.ts —
// die genereert een per-request nonce, wat nodig is omdat Next.js' App
// Router zelf inline <script>-tags injecteert voor RSC-hydratatie. Een
// statische CSP-header hier zou naast de nonce-CSP uit de middleware
// worden afgedwongen (de browser combineert meerdere CSP-headers restrictief),
// wat de nonce zou ondermijnen. Zie de comments in src/middleware.ts.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

if (isProd) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
