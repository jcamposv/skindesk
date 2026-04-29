import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake barrel imports of icon/UI libraries so a `import { X } from
  // 'lucide-react'` only ships X, not every icon in the package.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
