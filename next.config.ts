import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    appDir: true,   // ✅ ← これがないと app/api/* が動かない
    ppr: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
    ],
  },
};

export default nextConfig;
