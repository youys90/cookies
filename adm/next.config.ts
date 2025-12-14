import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "bnrsdiucywkeykskdzci.supabase.co",
      },
      {
        protocol: "https",
        hostname: "eftuvzzadxxtxzpgfqom.supabase.co",
      },
    ],
  },
};

export default nextConfig;
