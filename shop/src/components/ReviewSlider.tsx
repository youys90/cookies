"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

// Swiper 스타일
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

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
            className={`w-3.5 h-3.5 ${i < rating ? "text-yellow-400" : "text-gray-300"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  // 리뷰가 없으면 렌더링하지 않음
  if (loading || reviews.length === 0) {
    return null;
  }

  return (
    <section className="bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 섹션 타이틀 */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-light tracking-widest text-gray-900 mb-2">
            REVIEWS
          </h2>
          <p className="text-sm text-gray-500">
            {language === "ko" ? "고객님들의 소중한 후기" : "お客様の声"}
          </p>
        </div>

        {/* Swiper 슬라이더 */}
        <Swiper
          modules={[Autoplay, Pagination, Navigation]}
          spaceBetween={16}
          slidesPerView={1}
          centeredSlides={false}
          loop={reviews.length > 3}
          autoplay={{
            delay: 5000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }}
          pagination={{
            clickable: true,
            dynamicBullets: true,
          }}
          navigation={{
            enabled: true,
          }}
          breakpoints={{
            // 모바일: 1개
            0: {
              slidesPerView: 1,
              spaceBetween: 12,
            },
            // 태블릿: 2개
            640: {
              slidesPerView: 2,
              spaceBetween: 16,
            },
            // 데스크톱: 3개
            1024: {
              slidesPerView: 3,
              spaceBetween: 20,
            },
          }}
          className="review-swiper pb-12"
        >
          {reviews.map((review) => (
            <SwiperSlide key={review.id}>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden h-full">
                {/* 이미지 */}
                <div className="relative aspect-[4/3] bg-gray-100">
                  <Image
                    src={review.image_url}
                    alt={review.author_name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {/* 내용 */}
                <div className="p-4">
                  {renderStars(review.rating)}
                  {review.content && (
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                      "{review.content}"
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    - {review.author_name}
                  </p>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* Swiper 커스텀 스타일 */}
      <style jsx global>{`
        .review-swiper .swiper-pagination-bullet {
          background: #9ca3af;
          opacity: 0.5;
        }
        .review-swiper .swiper-pagination-bullet-active {
          background: #111827;
          opacity: 1;
        }
        .review-swiper .swiper-button-prev,
        .review-swiper .swiper-button-next {
          color: #111827;
          width: 40px;
          height: 40px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .review-swiper .swiper-button-prev::after,
        .review-swiper .swiper-button-next::after {
          font-size: 16px;
          font-weight: bold;
        }
        /* 모바일에서 네비게이션 숨김 */
        @media (max-width: 640px) {
          .review-swiper .swiper-button-prev,
          .review-swiper .swiper-button-next {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
