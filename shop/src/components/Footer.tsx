"use client";
// 셀렉트샵 패턴 푸터 (정보 위주 - 회사정보 / 고객센터 / SNS / 사업자정보)
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Footer() {
  const { language, t } = useLanguage();

  return (
    <footer className="bg-[var(--color-bg-soft)] border-t border-[var(--color-line)] mt-20">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* 1. 회사 정보 */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="font-serif text-xl tracking-wider text-[var(--color-text)] block mb-3">
              CREAM
            </Link>
            <p className="text-[12px] text-[var(--color-text-soft)] leading-relaxed">
              {language === "ja"
                ? <>東京から、ときめくアイテムを<br />あなたへお届けします。</>
                : <>도쿄에서, 두근거리는 아이템을<br />당신에게 전달합니다.</>}
            </p>
          </div>

          {/* 2. SHOP 메뉴 */}
          <div>
            <h4 className="text-[11px] tracking-[0.2em] text-[var(--color-text)] mb-4">SHOP</h4>
            <ul className="space-y-2.5 text-[12px] text-[var(--color-text-soft)]">
              <li><Link href="/?cat=all" className="hover:text-[var(--color-text)]">NEW IN</Link></li>
              <li><Link href="/?cat=acc" className="hover:text-[var(--color-text)]">{language === "ja" ? "アクセサリー" : "ACC"}</Link></li>
              <li><Link href="/?cat=bag" className="hover:text-[var(--color-text)]">{language === "ja" ? "バッグ" : "BAG"}</Link></li>
              <li><Link href="/?cat=sale" className="hover:text-[var(--color-text)]">SALE</Link></li>
            </ul>
          </div>

          {/* 3. CUSTOMER — 실제로 열려있는 항목만 */}
          <div>
            <h4 className="text-[11px] tracking-[0.2em] text-[var(--color-text)] mb-4">CUSTOMER</h4>
            <ul className="space-y-2.5 text-[12px] text-[var(--color-text-soft)]">
              <li><Link href="/reviews" className="hover:text-[var(--color-text)]">REVIEW</Link></li>
            </ul>
          </div>

          {/* 4. CONTACT — 운영시간 */}
          <div>
            <h4 className="text-[11px] tracking-[0.2em] text-[var(--color-text)] mb-4">CONTACT</h4>
            <div className="text-[11px] text-[var(--color-text-soft)]">
              <p className="text-[10px] tracking-[0.2em] text-[var(--color-text-mute)] mb-1">
                {language === "ja" ? "OPERATING HOURS" : "운영시간"}
              </p>
              <p className="text-[12px]">
                {language === "ja" ? "月〜金 10:00 - 18:00" : "월-금 10:00 - 18:00"}
              </p>
              <p className="text-[10px] text-[var(--color-text-mute)] mt-0.5">
                {language === "ja" ? "土日祝 定休" : "주말·공휴일 정기휴무"}
              </p>
            </div>
          </div>
        </div>

        {/* ─── 하단 사업자 정보 ─── */}
        <div className="border-t border-[var(--color-line)] mt-12 pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[11px] text-[var(--color-text-mute)]">
          <div className="space-y-1">
            <p>{language === "ja" ? "運営会社: CREAM" : "운영 회사: CREAM"} | CEO: ―</p>
            <p>{language === "ja" ? "事業者番号" : "사업자등록번호"}: ― | {language === "ja" ? "通信販売" : "통신판매신고"}: ―</p>
            <p>{language === "ja" ? "住所" : "주소"}: ―</p>
          </div>
          <div className="flex items-center gap-4">
            <p>{t("footer.copyright")}</p>
            <Link href="/?staff=1" className="opacity-40 hover:opacity-100">Staff</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
