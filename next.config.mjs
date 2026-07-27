const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Baseline hardening headers — not a maximally strict CSP (script-src/
// style-src keep 'unsafe-inline' since Next.js App Router injects an inline
// hydration script and several UI libs (Radix, React Flow, Recharts) set
// inline style properties; a nonce-based strict policy would need
// middleware + layout changes beyond this pass). frame-ancestors/object-src/
// connect-src are the directives that actually matter most for this app's
// threat model and are locked down for real.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseUrl ? ` ${supabaseUrl}` : ""}`,
  "font-src 'self'",
  `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        // Caching audit finding: unlike /_next/static/* (content-hashed by
        // webpack, already served `immutable, max-age=31536000` by Next
        // itself), files under /public keep their literal filename and get
        // Next's own conservative `max-age=0` default — confirmed via a
        // local production server, not assumed. logo.png specifically is
        // requested by that bare, unhashed name, so a full year+immutable
        // would risk serving a stale logo indefinitely if it's ever replaced
        // without a rename. A one-day window is long enough to meaningfully
        // cut repeat-visit requests without that risk.
        source: "/logo.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
