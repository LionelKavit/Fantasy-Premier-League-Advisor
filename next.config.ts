import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained production server (.next/standalone) so the app can be
  // packaged into a Docker container and run with `node server.js` anywhere.
  output: "standalone",
};

export default nextConfig;
