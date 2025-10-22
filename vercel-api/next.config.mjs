/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,  // ← これが有効になる
    ppr: true
  },
  images: {
    remotePatterns: [
      { hostname: "avatar.vercel.sh" }
    ]
  }
};

export default nextConfig;
