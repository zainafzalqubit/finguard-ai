import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mozaik pulls in provider SDKs; load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["@mozaik-ai/core"],
  // The floating dev badge covers the findings card in demos.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
