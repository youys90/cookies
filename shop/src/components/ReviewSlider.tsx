"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import ReviewWriteModal from "./ReviewWriteModal";

// Swiper 스타일
import "swiper/css";
import "swiper/css/pagination";

interface Review {
  id: string;
  image_url: string;
  rating: number;
  content: string;
  author_name: string;
}

export default function ReviewSlider() {
  const { language } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWriteModal, setShowWriteModal] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from("reviews")
      .select("id, image_url, rating, content, author_name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(15);

    if (error) {
      console.error("리뷰 조회 실패:", error);
    } else {
      setReviews(data || []);
    }
    setLoading(false);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <svg
            key={i}
            className={`w-3 h-3 ${i < rating ? "text-yellow-400" : "text-gray-300"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  const t = {
    subtitle: language === "ko" ? "고객님들의 소중한 후기" : "お客様の声",
    writeBtn: language === "ko" ? "리뷰 작성" : "レビューを書く",
    viewAll: language === "ko" ? "전체보기" : "すべて見る",
    emptyTitle: language === "ko" ? "첫 리뷰를 남겨주세요!" : "最初のレビューを書いてください！",
    emptyDesc: language === "ko"
      ? "상품 후기를 남겨주시면 다른 고객님들께 큰 도움이 됩니다."
      : "商品のレビューを残していただくと、他のお客様の参考になります。",
  };

  // 로딩 중이면 렌더링하지 않음
  if (loading) {
    return null;
  }

  return (
    <section className="bg-gray-50 py-6">
      <div className="max-w-5xl mx-auto px-4">
        {/* 섹션 타이틀 */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-3">
            <Link href="/reviews" className="text-sm font-medium tracking-widest text-gray-900 hover:text-gray-600 transition-colors">
              REVIEWS
            </Link>
            <button
              onClick={() => setShowWriteModal(true)}
              className="px-3 py-1 text-xs bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors"
            >
              {t.writeBtn}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t.subtitle}
          </p>
        </div>

        {/* 리뷰가 없을 때 */}
        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">{t.emptyTitle}</p>
            <p className="text-xs text-gray-500 mt-1">{t.emptyDesc}</p>
          </div>
        ) : (
          <>
          
            <Swiper
            modules={[Autoplay, Pagination]}
            spaceBetween={12}
            slidesPerView={2}
            loop={reviews.length > 4}
            autoplay={{
              delay: 4000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            pagination={{
              clickable: true,
              dynamicBullets: true,
            }}
            breakpoints={{
              // 모바일: 2개
              0: {
                slidesPerView: 2,
                spaceBetween: 8,
              },
              // 태블릿: 3개
              640: {
                slidesPerView: 3,
                spaceBetween: 12,
              },
              // 데스크톱: 4개
              1024: {
                slidesPerView: 4,
                spaceBetween: 16,
              },
            }}
            className="review-swiper pb-8"
          >
            {reviews.map((review) => (
              <SwiperSlide key={review.id}>
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  {/* 이미지 */}
                  {review.image_url && (
                    <div className="relative aspect-square bg-gray-100">
                      <Image
                        src={review.image_url}
                        alt={review.author_name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}

                  {/* 내용 - 컴팩트 */}
                  <div className="p-2">
                    {renderStars(review.rating)}
                    {review.content && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                        "{review.content}"
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      - {review.author_name}
                    </p>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

            {/* 전체보기 링크 */}
            <div className="text-center mt-2">
              <Link
                href="/reviews"
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
              >
                {t.viewAll}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Swiper 커스텀 스타일 */}
      <style jsx global>{`
        .review-swiper .swiper-pagination-bullet {
          background: #9ca3af;
          opacity: 0.5;
          width: 6px;
          height: 6px;
        }
        .review-swiper .swiper-pagination-bullet-active {
          background: #111827;
          opacity: 1;
        }
      `}</style>

      {/* 리뷰 작성 모달 */}
      <ReviewWriteModal
        isOpen={showWriteModal}
        onClose={() => setShowWriteModal(false)}
        onSuccess={fetchReviews}
      />
    </section>
  );
}
