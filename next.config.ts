import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone only when building for desktop (set NEXT_STANDALONE=1)
  ...(process.env.NEXT_STANDALONE === '1' ? { output: 'standalone' } : {}),
};

export default nextConfig;
