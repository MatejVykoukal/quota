import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker / Railway deployment
  output: "standalone",
};

export default nextConfig;
