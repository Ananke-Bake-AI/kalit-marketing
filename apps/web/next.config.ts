import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kalit/core", "@kalit/db"],
};

export default nextConfig;
