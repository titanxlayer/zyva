import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone only when building for desktop (set NEXT_STANDALONE=1)
  ...(process.env.NEXT_STANDALONE === '1' ? { output: 'standalone' } : {}),

  // Required for WebContainer (WASM + SharedArrayBuffer)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
