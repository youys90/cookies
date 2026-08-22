import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Sans_JP, Playfair_Display } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DevBanner from "@/components/DevBanner";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { CartProvider } from "@/contexts/CartContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ShopUiProvider } from "@/contexts/ShopUiContext";
import SectionClickTracker from "@/components/SectionClickTracker";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-kr",
});

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-jp",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "CREAM (旧クッキー)",
  description: "心ときめくアイテムをお届けします。 CREAM の小さな雑貨店",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansKr.variable} ${notoSansJp.variable} ${playfair.variable} font-sans antialiased`}>
        <DevBanner />
        <ShopUiProvider>
          <LanguageProvider>
            <CartProvider>
              <SectionClickTracker />
              <Header />
              <LanguageSwitcher />
              <main className="min-h-screen">{children}</main>
              <Footer />
            </CartProvider>
          </LanguageProvider>
        </ShopUiProvider>
      </body>
    </html>
  );
}
