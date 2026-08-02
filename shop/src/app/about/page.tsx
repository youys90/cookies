"use client";
// CREAM BRAND 페이지 - 셀렉트샵 미니멀 톤 (자체 작성)
// 구조: 히어로 → 브랜드 스토리 → 큐레이션 원칙 → 매장 정보 → CONTACT
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface Product { id: number; image: string; images?: string[] | unknown; }

// 프리미엄 카테고리 매직 스트링 상수화 (adm 카테고리 관리와 동기화 필요)
const PREMIUM_CATEGORY_NAME_JA = "➡ Premium High-Quality ✨";
// 상품 부족 시 갤러리/스토어 이미지 폴백
const FALLBACK_IMG = "/images/brand-fallback.jpg";

export default function AboutPage() {
  const { language } = useLanguage();
  const [heroImg, setHeroImg] = useState<string>("");
  const [galleryImgs, setGalleryImgs] = useState<string[]>([]);
  const [storeImg, setStoreImg] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, image, images")
        .eq("is_active", true)
        .neq("category", PREMIUM_CATEGORY_NAME_JA)
        .order("created_at", { ascending: false })
        .limit(6);
      const arr = (data as Product[]) || [];
      setHeroImg(arr[0]?.image || FALLBACK_IMG);
      // 갤러리 3장 확보 - 부족하면 폴백으로 채움
      const gallery = arr.slice(1, 4).map((p) => p.image).filter(Boolean);
      while (gallery.length < 3) gallery.push(FALLBACK_IMG);
      setGalleryImgs(gallery);
      // STORE 이미지는 갤러리와 겹치지 않도록 arr[4] 이상 사용
      setStoreImg(arr[4]?.image || arr[5]?.image || FALLBACK_IMG);
    })();
  }, []);

  // 문의용 이메일 (LINE 공식계정 확정 전까지 안전한 채널)
  const CONTACT_EMAIL = "info@cream-shop.jp";
  // 매장 주소 확정 여부 (미확정 상태에서 플레이스홀더 노출 방지)
  const STORE_ADDR_CONFIRMED = false;

  const t = {
    // 브랜드 카피는 의도적으로 영문 유지 (양 언어 동일)
    hero_kicker: "CREAM — SELECT SHOP",
    hero_title: "little happiness",
    hero_desc:
      language === "ja"
        ? "東京から、ときめくアイテムをあなたへ。\n毎日を少しだけ特別にする、小さな雑貨を厳選してお届けします。"
        : "도쿄에서, 두근거리는 아이템을 당신에게.\n일상을 조금 더 특별하게 만드는 작은 소품을 엄선해 전합니다.",
    story_kicker: "01 — ABOUT",
    story_title: "Our Story",
    story_body:
      language === "ja"
        ? "CREAM（クリーム）は、旧「クッキー」からリニューアルしたセレクトショップです。\n私たちは、東京の小さな雑貨店の心地よい空気感を、そのままあなたの日常にお届けしたいと願っています。\n\n派手な流行を追うのではなく、長く愛せる質感と、そっと寄り添うデザイン。手にした瞬間から、ふっと気持ちが軽くなるような小物たちを、ひとつひとつ丁寧に選びました。"
        : "CREAM(크림)은 기존 '쿠키(Cookie)'에서 새롭게 리뉴얼한 셀렉트샵입니다.\n저희는 도쿄의 작은 잡화점이 지닌 편안한 공기감을 그대로 여러분의 일상으로 전하고 싶습니다.\n\n화려한 유행을 좇기보다는 오래 사랑할 수 있는 질감과 조용히 곁을 지키는 디자인. 손에 든 순간 마음이 가벼워지는 소품들을 하나하나 정성껏 골랐습니다.",
    concept_kicker: "02 — CURATION",
    concept_title: "How we curate",
    p1_title: "QUALITY",
    p1_body: language === "ja" ? "スタッフが一点ずつ検品。実物撮影で安心してお選びいただけます。" : "스태프가 한 점씩 검품. 실물 촬영으로 안심하고 고르실 수 있습니다.",
    p2_title: "DESIGN",
    p2_body: language === "ja" ? "流行より、長く愛せるデザインを軸に。日々に馴染む形と色を選びます。" : "유행보다 오래 사랑할 수 있는 디자인을 축으로. 매일에 자연스럽게 어울리는 형태와 색을 고릅니다.",
    p3_title: "STORY",
    p3_body: language === "ja" ? "作り手の想いや素材の背景まで。物語のあるアイテムだけをお届けします。" : "만든 이의 마음과 소재의 배경까지. 이야기가 있는 아이템만을 전합니다.",
    store_kicker: "03 — STORE",
    store_title: "Real Store",
    store_body:
      language === "ja"
        ? "東京・表参道の路地裏に、小さな実店舗があります。\nオンラインでご覧いただいたアイテムを、実際に手に取ってお試しいただけます。"
        : "도쿄 오모테산도 골목 안에 작은 실매장이 있습니다.\n온라인에서 보신 아이템을 실제로 만져보실 수 있습니다.",
    // 실주소 확정 전까지 안내 문구로 대체
    store_addr: STORE_ADDR_CONFIRMED
      ? (language === "ja" ? "東京都渋谷区神宮前 x-x-x" : "도쿄도 시부야구 진구마에 x-x-x")
      : (language === "ja" ? "移転準備中" : "매장 이전 준비 중"),
    store_hours: language === "ja" ? "12:00 - 19:00 / 火曜定休" : "12:00 - 19:00 / 화요일 정기휴무",
    // ADDRESS/HOURS 라벨 다국어화
    label_address: language === "ja" ? "住所" : "주소",
    label_hours: language === "ja" ? "営業時間" : "영업시간",
    contact_kicker: "04 — CONTACT",
    contact_title: "Say hello",
    // LINE 언급 제거, 실제 운영 채널만 안내
    contact_body:
      language === "ja"
        ? "ご質問・スタイリング相談など、下記チャンネルよりお気軽にお問い合わせください。"
        : "궁금하신 점이나 스타일링 상담은 아래 채널을 이용해 주세요.",
    contact_email_cta: language === "ja" ? "メールでお問い合わせ" : "이메일로 문의하기",
    shop_cta: "SHOP NOW",
    contact_email: CONTACT_EMAIL,
  };

  return (
    <div className="bg-white text-[var(--color-text)]">
      {/* ─── 히어로 ─── */}
      <section className="relative">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 pt-10 lg:pt-16 pb-12 lg:pb-20">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-14 items-center">
            {/* 좌 텍스트 */}
            <div>
              <p className="text-[10px] tracking-[0.35em] text-[var(--color-text-mute)] mb-4">{t.hero_kicker}</p>
              <p className="font-serif text-[56px] lg:text-[84px] leading-[0.95] tracking-tight text-[var(--color-text)]">CREAM</p>
              <p className="font-serif italic text-[16px] lg:text-[18px] text-[var(--color-text-soft)] mt-2">{t.hero_title}</p>
              <p className="text-[13px] lg:text-[14px] text-[var(--color-text-soft)] leading-[1.9] mt-6 whitespace-pre-line max-w-[440px]">
                {t.hero_desc}
              </p>
              <div className="mt-8 flex items-center gap-2">
                <Link href="/" className="inline-flex items-center h-11 px-6 bg-[var(--color-text)] text-white text-[11px] tracking-[0.3em]">
                  {t.shop_cta}
                </Link>
              </div>
            </div>
            {/* 우 큰 이미지 */}
            <div className="relative aspect-[4/5] lg:aspect-[5/6] bg-[var(--color-bg-soft)] overflow-hidden">
              {heroImg && <Image src={heroImg} alt="CREAM" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 55vw" priority />}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 01 STORY ─── */}
      <section className="border-t border-[var(--color-line-soft)]">
        <div className="max-w-[1000px] mx-auto px-4 lg:px-8 py-16 lg:py-24 text-center">
          <p className="text-[10px] tracking-[0.35em] text-[var(--color-text-mute)] mb-3">{t.story_kicker}</p>
          <h2 className="font-serif text-[36px] lg:text-[48px] leading-tight">{t.story_title}</h2>
          <div className="w-8 h-px bg-[var(--color-text)] mx-auto my-8" />
          <p className="text-[13px] lg:text-[14px] text-[var(--color-text-soft)] leading-[2] whitespace-pre-line text-left">
            {t.story_body}
          </p>
        </div>
      </section>

      {/* ─── 이미지 갤러리 (3장, 부족 시 폴백으로 채워져 항상 렌더) ─── */}
      {galleryImgs.length > 0 && (
        <section className="border-t border-[var(--color-line-soft)]">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-10 lg:py-14">
            <div className="grid grid-cols-3 gap-3 lg:gap-5">
              {galleryImgs.map((u, i) => (
                <div key={i} className="relative aspect-square bg-[var(--color-bg-soft)] overflow-hidden">
                  <Image src={u} alt={`CREAM ${i + 1}`} fill className="object-cover" sizes="33vw" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── 02 CURATION ─── */}
      <section className="border-t border-[var(--color-line-soft)] bg-[var(--color-bg-soft)]">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-16 lg:py-24">
          <div className="text-center mb-12 lg:mb-16">
            <p className="text-[10px] tracking-[0.35em] text-[var(--color-text-mute)] mb-3">{t.concept_kicker}</p>
            <h2 className="font-serif text-[36px] lg:text-[48px] leading-tight">{t.concept_title}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              { title: t.p1_title, body: t.p1_body, num: "01" },
              { title: t.p2_title, body: t.p2_body, num: "02" },
              { title: t.p3_title, body: t.p3_body, num: "03" },
            ].map((p) => (
              <div key={p.num} className="text-center">
                <p className="font-serif italic text-[24px] text-[var(--color-text-mute)] mb-3">{p.num}</p>
                <h3 className="text-[13px] tracking-[0.3em] text-[var(--color-text)] mb-4">{p.title}</h3>
                <div className="w-4 h-px bg-[var(--color-text-mute)] mx-auto mb-4" />
                <p className="text-[12px] lg:text-[13px] text-[var(--color-text-soft)] leading-[1.9]">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 03 STORE ─── */}
      <section className="border-t border-[var(--color-line-soft)]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="relative aspect-[4/3] bg-[var(--color-bg-cream)] overflow-hidden">
              {storeImg && <Image src={storeImg} alt={language === "ja" ? "実店舗" : "실매장"} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />}
            </div>
            <div>
              <p className="text-[10px] tracking-[0.35em] text-[var(--color-text-mute)] mb-3">{t.store_kicker}</p>
              <h2 className="font-serif text-[36px] lg:text-[48px] leading-tight">{t.store_title}</h2>
              <div className="w-8 h-px bg-[var(--color-text)] my-6" />
              <p className="text-[13px] lg:text-[14px] text-[var(--color-text-soft)] leading-[1.9] whitespace-pre-line">
                {t.store_body}
              </p>
              <div className="mt-6 space-y-1 text-[12px] text-[var(--color-text-soft)]">
                <p><span className="tracking-[0.2em] text-[var(--color-text-mute)] mr-3">{t.label_address}</span>{t.store_addr}</p>
                <p><span className="tracking-[0.2em] text-[var(--color-text-mute)] mr-3">{t.label_hours}</span>{t.store_hours}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 04 CONTACT ─── */}
      <section className="border-t border-[var(--color-line-soft)] bg-[var(--color-bg-cream)]">
        <div className="max-w-[900px] mx-auto px-4 lg:px-8 py-16 lg:py-24 text-center">
          <p className="text-[10px] tracking-[0.35em] text-[var(--color-text-mute)] mb-3">{t.contact_kicker}</p>
          <h2 className="font-serif text-[36px] lg:text-[48px] leading-tight">{t.contact_title}</h2>
          <div className="w-8 h-px bg-[var(--color-text)] mx-auto my-6" />
          <p className="text-[13px] text-[var(--color-text-soft)] leading-[1.9]">{t.contact_body}</p>
          <div className="mt-8 flex items-center justify-center gap-2">
            <a
              href={`mailto:${t.contact_email}`}
              className="inline-flex items-center h-11 px-6 bg-[var(--color-text)] text-white text-[11px] tracking-[0.3em]"
            >
              {t.contact_email_cta}
            </a>
          </div>
          <p className="mt-4 text-[11px] tracking-[0.15em] text-[var(--color-text-mute)]">{t.contact_email}</p>
        </div>
      </section>
    </div>
  );
}
