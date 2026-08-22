import type { Metadata } from "next";
import { Noto_Sans_KR, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdmLanguageProvider } from "@/contexts/LanguageContext";
import LayoutContent from "@/components/LayoutContent";
import DevBanner from "@/components/DevBanner";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-kr",
});

const playfairAdm = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair-adm",
});

export const metadata: Metadata = {
  title: "CREAM Admin",
  description: "CREAM 관리자 페이지",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.variable} ${playfairAdm.variable} font-sans antialiased`}>
        <DevBanner />
        <AuthProvider>
          <AdmLanguageProvider>
            <LayoutContent>{children}</LayoutContent>
          </AdmLanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
