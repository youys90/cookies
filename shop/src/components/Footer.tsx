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
              mignon
            </Link>
            <p className="text-[12px] text-[var(--color-text-soft)] leading-relaxed">
              {language === "ja"
                ? <>東京から、ときめくアイテムを<br />あなたへお届けします。</>
                : <>도쿄에서, 두근거리는 아이템을<br />당신에게 전달합니다.</>}
            </p>
            <div className="flex items-center gap-2.5 mt-5">
              <a href="#" aria-label="instagram" className="w-8 h-8 rounded-full bg-white border border-[var(--color-line)] flex items-center justify-center hover:bg-[var(--color-text)] hover:text-white transition">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
                </svg>
              </a>
              <a href="#" aria-label="line" className="w-8 h-8 rounded-full bg-white border border-[var(--color-line)] flex items-center justify-center hover:bg-[var(--color-text)] hover:text-white transition">
                <span className="text-[10px] font-medium">LINE</span>
              </a>
              <a href="#" aria-label="kakao" className="w-8 h-8 rounded-full bg-white border border-[var(--color-line)] flex items-center justify-center hover:bg-[var(--color-text)] hover:text-white transition">
                <span className="text-[10px] font-medium">K</span>
              </a>
            </div>
          </div>

          {/* 2. SHOP 메뉴 */}
          <div>
            <h4 className="text-[11px] tracking-[0.2em] text-[var(--color-text)] mb-4">SHOP</h4>
            <ul className="space-y-2.5 text-[12px] text-[var(--color-text-soft)]">
              <li><Link href="/?cat=all" className="hover:text-[var(--color-text)]">NEW IN</Link></li>
              <li><Link href="/?cat=all" className="hover:text-[var(--color-text)]">BEST</Link></li>
              <li><Link href="/?cat=accessory" className="hover:text-[var(--color-text)]">{language === "ja" ? "アクセサリー" : "ACC"}</Link></li>
              <li><Link href="/?cat=fashion" className="hover:text-[var(--color-text)]">{language === "ja" ? "ファッション" : "FASHION"}</Link></li>
              <li><Link href="/?cat=sale" className="hover:text-[var(--color-text)]">SALE</Link></li>
            </ul>
          </div>

          {/* 3. CUSTOMER */}
          <div>
            <h4 className="text-[11px] tracking-[0.2em] text-[var(--color-text)] mb-4">CUSTOMER</h4>
            <ul className="space-y-2.5 text-[12px] text-[var(--color-text-soft)]">
              <li><Link href="#" className="hover:text-[var(--color-text)]">{language === "ja" ? "ご利用ガイド" : "이용 가이드"}</Link></li>
              <li><Link href="#" className="hover:text-[var(--color-text)]">{language === "ja" ? "お支払いについて" : "결제 안내"}</Link></li>
              <li><Link href="#" className="hover:text-[var(--color-text)]">{language === "ja" ? "配送・返品について" : "배송・반품"}</Link></li>
              <li><Link href="/reviews" className="hover:text-[var(--color-text)]">REVIEW</Link></li>
              <li><Link href="#" className="hover:text-[var(--color-text)]">Q&A</Link></li>
            </ul>
          </div>

          {/* 4. CONTACT — LINE 카드형 강화 */}
          <div>
            <h4 className="text-[11px] tracking-[0.2em] text-[var(--color-text)] mb-4">CONTACT</h4>

            {/* LINE 큰 카드 */}
            <a href="#" className="block bg-[#06C755] text-white p-4 hover:bg-[#05B048] transition group">
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-white text-[#06C755] rounded-sm text-[10px] font-bold tracking-tight">LINE</span>
                <span className="text-[11px] tracking-[0.15em] opacity-90">FRIEND ADD</span>
              </div>
              <p className="text-[12px] leading-snug mt-2">
                {language === "ja" ? "LINEでお問い合わせ" : "LINE으로 문의하기"}
              </p>
              <p className="text-[10px] opacity-80 mt-1">
                {language === "ja" ? "友だち追加で最新情報&クーポン配布" : "친구 추가로 최신 소식·쿠폰 제공"}
              </p>
              <div className="mt-2.5 flex items-center gap-1 text-[10px] tracking-[0.2em] opacity-90 group-hover:opacity-100">
                <span>OPEN CHAT</span>
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h6M6 3l3 3-3 3" /></svg>
              </div>
            </a>

            {/* 운영시간 */}
            <div className="mt-4 text-[11px] text-[var(--color-text-soft)]">
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
            <p>{language === "ja" ? "運営会社: mignon" : "운영 회사: mignon"} | CEO: ―</p>
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
