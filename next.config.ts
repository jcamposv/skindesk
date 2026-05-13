import type { NextConfig } from "next";

/**
 * Supabase Storage hostname — derived from the public env var so dev /
 * staging / prod all "just work" without a config edit. Falls back to a
 * permissive wildcard if the env isn't loaded at build time (e.g. typecheck
 * in CI without env).
 */
const supabaseHost = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Tree-shake barrel imports of icon/UI libraries so a `import { X } from
  // 'lucide-react'` only ships X, not every icon in the package.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      // Supabase Storage signed URLs (productos-photos, avatars, etc.).
      // Pinning to the project's exact hostname avoids `images.domains`
      // accepting arbitrary `*.supabase.co` traffic.
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/**",
            },
          ]
        : [
            // Fallback: allow any Supabase Storage host. Used only when the
            // env var isn't present at build time.
            {
              protocol: "https" as const,
              hostname: "*.supabase.co",
              pathname: "/storage/v1/object/**",
            },
          ]),
      // Unsplash — used for the marketing hero placeholder until the team
      // ships custom photography. Safe to whitelist: Unsplash hotlinking is
      // their advertised use case.
      {
        protocol: "https" as const,
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
