import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/*": [
      "./node_modules/@solana/web3.js/**/*",
      "./node_modules/jayson/**/*",
      "./node_modules/rpc-websockets/**/*",
      "./node_modules/@solana/buffer-layout/**/*",
      "./node_modules/@solana/codecs-numbers/**/*",
    ],
  },
  turbopack: {
    resolveAlias: {
      buffer: "buffer",
    },
  },
  webpack: (config, { isServer, webpack }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ["buffer", "Buffer"],
      }),
    );
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
