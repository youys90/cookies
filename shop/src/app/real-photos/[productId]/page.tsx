"use client";

// 실사진 (REAL PHOTOS) · 사용자용 상세 페이지 · P-02 (2026-09-24)
// - 판매용 상품 상세 (`/product/[id]`) 와는 별개 · 순수 사진 뷰어
// - product_photos 에서 image_url + sort_order 정렬 순서만 사용
//   · storage_path · caption · id · created_at · snapshot · product_id orphan 값 등 사용자 노출 X
// - 상단: 상품명 (판매용 이름 · 언어 스위처 반영)
// - 메인: 큰 이미지 + 좌/우 화살표 + 손가락 좌우 스와이프 (flick) · P-03 gallery 패턴 인라인 복제
//   · 회귀 위험 최소화 위해 판매 상품 상세 gallery 는 이번 P-02 에서 손대지 X
//   · 코드 중복은 추후 유지보수 티켓으로 이관 (완료 보고 항목 9 참고)
// - 하단: filmstrip (가로 스크롤) + counter (사진 많을 때만) + 「商品を見る / 상품 보기」 링크
// - 특수(비밀) 카테고리 상품 URL 직접 진입 차단 · 판매 상세와 동일 정책 적용

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProductInfo {
  id: number;
  name: string;
  name_ko?: string | null;
  name_ja?: string | null;
  category?: string | null;
  category_id?: number | null;
}

interface PhotoRow {
  image_url: string;
  sort_order: number;
}

// 실사진 상세 · gallery UI 상수 (P-03 productDetail config 와는 별개 · shop 관리자 노출 안 함)
const THUMB_SIZE = 72;
const THUMB_GAP = 8;
const COUNTER_MIN = 5; // 5장 초과 시 counter 노출 (dots 대신)

// P-03 gallery 상수 (인라인 복제)
const SWIPE_THRESHOLD = 50;
const FLICK_VELOCITY = 0.5;
const DIRECTION_LOCK_MIN = 8;

export default function RealPhotosDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { language } = useLanguage();
  const productId = Number(params.productId);

  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  // 스와이프/flick · P-03 인라인 복제
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [gestureDir, setGestureDir] = useState<null | "h" | "v">(null);

  // filmstrip auto-scroll 억제 (사용자가 직접 만졌을 때)
  const filmstripRef = useRef<HTMLDivElement | null>(null);
  const lastUserScrollAtRef = useRef(0);

  useEffect(() => {
    if (Number.isNaN(productId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);

      // 1) 상품 존재 여부 및 특수 카테고리 확인
      const { data: prod } = await supabase
        .from("products")
        .select("id, name, name_ko, name_ja, category, category_id, is_active")
        .eq("id", productId)
        .single();
      if (!prod) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      // 판매 비활성 상품은 실사진도 노출 X (관리자 숨김 정책 계승)
      if (prod.is_active === false) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // 특수 (비밀) 카테고리 상품 · 세션 unlock 없으면 홈으로 리다이렉트
      // (판매용 상품 상세와 동일 정책 · 실사진에서도 우회 진입 차단)
      if (prod.category_id) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id, is_special")
          .eq("id", prod.category_id)
          .maybeSingle();
        if (cat?.is_special) {
          let unlocked = false;
          try {
            const r = await fetch(`/api/staff/session?categoryId=${cat.id}`, {
              cache: "no-store",
              credentials: "same-origin",
            });
            if (r.ok) {
              const j = await r.json().catch(() => ({ ok: false }));
              unlocked = !!j.ok;
            }
          } catch {
            unlocked = false;
          }
          if (!unlocked) {
            router.replace(`/?cat=${encodeURIComponent(prod.category || "")}`);
            return;
          }
        }
      }

      setProduct(prod as ProductInfo);

      // 2) 실사진 · sort_order 오름차순 · orphan(product_id null) 방어 필터
      const { data: photos } = await supabase
        .from("product_photos")
        .select("image_url, sort_order")
        .eq("product_id", productId)
        .not("product_id", "is", null)
        .order("sort_order", { ascending: true });
      const urls = ((photos || []) as PhotoRow[])
        .map((r) => r.image_url)
        .filter((u): u is string => typeof u === "string" && u.length > 0);
      setImages(urls);
      setLoading(false);
    })();
  }, [productId, router]);

  // filmstrip auto-scroll · imgIdx 변경 시 현재 썸네일 뷰포트 안으로
  // 사용자가 방금 filmstrip 직접 만졌으면 억제 (튐 방지 · P-03 동일 패턴)
  useEffect(() => {
    const strip = filmstripRef.current;
    if (!strip) return;
    const now = Date.now();
    if (now - lastUserScrollAtRef.current < 600) return;
    const target = strip.querySelector<HTMLElement>(`[data-thumb-idx="${imgIdx}"]`);
    if (!target) return;
    const stripRect = strip.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const outLeft = targetRect.left < stripRect.left;
    const outRight = targetRect.right > stripRect.right;
    if (outLeft || outRight) {
      target.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [imgIdx]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-[12px] tracking-[0.25em] text-[var(--color-text-soft)]">LOADING...</p>
      </div>
    );
  }
  if (notFound || !product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-[12px] tracking-[0.25em] text-[var(--color-text-soft)]">NOT FOUND</p>
        <Link
          href="/real-photos"
          className="text-[11px] tracking-[0.2em] text-[var(--color-text)] underline underline-offset-4"
        >
          {language === "ja" ? "実写真 一覧に戻る" : "실사진 목록으로"}
        </Link>
      </div>
    );
  }

  const getName = (p: ProductInfo) =>
    language === "ja" ? p.name_ja || p.name : p.name_ko || p.name;
  const displayName = getName(product);
  const subName = language === "ja" ? product.name_ko : product.name_ja;

  const currentImg = images[imgIdx] || "";

  const goPrev = () => setImgIdx((i) => (i - 1 + images.length) % images.length);
  const goNext = () => setImgIdx((i) => (i + 1) % images.length);

  // ── 스와이프/flick (P-03 인라인 복제) ────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (images.length <= 1) return;
    const t = e.touches[0];
    setTouchStartX(t.clientX);
    setTouchStartY(t.clientY);
    setTouchStartTime(Date.now());
    setDragOffset(0);
    setGestureDir(null);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (images.length <= 1) return;
    if (touchStartX === null || touchStartY === null) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (gestureDir === null) {
      if (Math.abs(dx) < DIRECTION_LOCK_MIN && Math.abs(dy) < DIRECTION_LOCK_MIN) return;
      setGestureDir(Math.abs(dx) > Math.abs(dy) ? "h" : "v");
      if (Math.abs(dx) > Math.abs(dy)) setDragOffset(dx);
      return;
    }
    if (gestureDir === "h") setDragOffset(dx);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) {
      setDragOffset(0);
      setGestureDir(null);
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const elapsed = Math.max(1, Date.now() - touchStartTime);
    const velocity = Math.abs(dx) / elapsed;
    const isHorizontal =
      gestureDir === "h" || (gestureDir === null && Math.abs(dx) > Math.abs(dy));
    setTouchStartX(null);
    setTouchStartY(null);
    setGestureDir(null);
    setDragOffset(0);
    if (!isHorizontal) return;
    const shouldAdvance =
      Math.abs(dx) >= SWIPE_THRESHOLD ||
      (velocity >= FLICK_VELOCITY && Math.abs(dx) >= DIRECTION_LOCK_MIN);
    if (!shouldAdvance) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  return (
    <div className="bg-white text-[var(--color-text)]">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-10 pb-20">
        {/* 상단 · 목록으로 · 미니멀 텍스트 링크 */}
        <div className="mb-4">
          <Link
            href="/real-photos"
            className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.15em] text-[var(--color-text-soft)] hover:text-[var(--color-text)] transition"
          >
            <span>←</span>
            <span>{language === "ja" ? "実写真 一覧" : "실사진 목록"}</span>
          </Link>
        </div>

        {/* 상품명 · 판매용 이름 · 언어 스위처 반영 */}
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-[15px] md:text-[18px] tracking-[0.05em] text-[var(--color-text)] uppercase">
            {displayName}
          </h1>
          {subName && (
            <p className="text-[11px] text-[var(--color-text-soft)] mt-1">{subName}</p>
          )}
        </div>

        {images.length === 0 ? (
          <div className="min-w-0 min-h-[40vh] flex items-center justify-center bg-[var(--color-bg-soft)]">
            <p className="text-[12px] tracking-[0.25em] text-[var(--color-text-soft)]">NO PHOTOS</p>
          </div>
        ) : (
          <div className="min-w-0">
            {/* 큰 이미지 · aspect-square · 좌우 화살표 · 손가락 스와이프 */}
            <div
              className="relative aspect-square bg-[var(--color-bg-soft)] overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ touchAction: "pan-y" }}
            >
              <div
                className="absolute inset-0"
                style={{
                  transform: `translate3d(${dragOffset}px, 0, 0)`,
                  transition: dragOffset === 0 ? "transform 0.25s ease-out" : "none",
                  willChange: dragOffset !== 0 ? "transform" : "auto",
                }}
              >
                {currentImg && (
                  <Image
                    src={currentImg}
                    alt={`${displayName} · ${imgIdx + 1}`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 900px) 100vw, 900px"
                    priority
                    unoptimized
                  />
                )}
              </div>

              {/* 좌우 화살표 (2장 이상일 때) */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/85 backdrop-blur-sm flex items-center justify-center hover:bg-white transition"
                    aria-label="prev"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M15 6l-6 6 6 6" />
                    </svg>
                  </button>
                  <button
                    onClick={goNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/85 backdrop-blur-sm flex items-center justify-center hover:bg-white transition"
                    aria-label="next"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </>
              )}

              {/* Counter · 5장 초과일 때만 노출 (사장님 명시 · 예: > 5장) */}
              {images.length > COUNTER_MIN && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[11px] tracking-[0.15em] px-2.5 py-1 rounded-full tabular-nums">
                  {imgIdx + 1} / {images.length}
                </div>
              )}
              {/* 소량 (2~5장) · dots (P-03 동일) */}
              {images.length > 1 && images.length <= COUNTER_MIN && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        i === imgIdx ? "bg-[var(--color-text)]" : "bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Filmstrip · 사진 여러 장일 때만 · 가로 스크롤 · min-w-0 자연 계승 */}
            {images.length > 1 && (
              <div
                ref={filmstripRef}
                onScroll={() => {
                  lastUserScrollAtRef.current = Date.now();
                }}
                onTouchStart={() => {
                  lastUserScrollAtRef.current = Date.now();
                }}
                className="mt-3 flex overflow-x-auto no-scrollbar"
                style={{
                  gap: `${THUMB_GAP}px`,
                  paddingLeft: 4,
                  paddingRight: 4,
                  scrollbarWidth: "none",
                  touchAction: "pan-x",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {images.map((u, i) => (
                  <button
                    key={i}
                    data-thumb-idx={i}
                    onClick={() => setImgIdx(i)}
                    style={{ width: `${THUMB_SIZE}px`, height: `${THUMB_SIZE}px` }}
                    className={`relative flex-shrink-0 bg-[var(--color-bg-soft)] overflow-hidden border ${
                      i === imgIdx
                        ? "border-[var(--color-text)]"
                        : "border-transparent hover:border-[var(--color-line)]"
                    }`}
                    aria-label={`image ${i + 1}`}
                    aria-current={i === imgIdx}
                  >
                    <Image src={u} alt={`thumb-${i}`} fill className="object-cover" sizes="72px" unoptimized />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 상품으로 이동 링크 · 작게 · 사장님 명시 */}
        <div className="mt-8 text-center">
          <Link
            href={`/product/${product.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--color-line)] text-[11px] tracking-[0.2em] text-[var(--color-text)] hover:border-[var(--color-text-soft)] hover:bg-[var(--color-bg-soft)] transition"
          >
            <span>{language === "ja" ? "商品を見る" : "상품 보기"}</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
