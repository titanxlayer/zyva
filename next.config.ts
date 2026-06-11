import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles a minimal server (.next/standalone/server.js),
  // used both by the Docker image and the Electron desktop wrapper.
  output: "standalone",
};

export default nextConfig;
