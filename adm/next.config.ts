import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel 자동 환경변수를 클라이언트에서도 사용 가능하게 노출
  // production/preview/development 구분 → 운영에서만 특정 기능 숨김 등에 사용
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV || "development",
  },
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
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
      },
    ],
  },
};

export default nextConfig;
