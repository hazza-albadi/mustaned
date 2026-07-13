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
    ];
  },
};

export default nextConfig;
