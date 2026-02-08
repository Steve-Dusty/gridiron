import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@odysseyml/odyssey"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // ws is only needed server-side; the browser uses native WebSocket
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: false,
      };
    }
    return config;
  },
};

export default nextConfig;
