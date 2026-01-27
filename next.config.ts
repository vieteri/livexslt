import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Disable web worker processing in SSR
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        worker_threads: false,
      };
    }
    return config;
  },
  // Acknowledge Turbopack while using a custom webpack configuration
  turbopack: {},
};

export default nextConfig;
