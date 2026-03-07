"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import ReviewWriteModal from "@/components/ReviewWriteModal";

interface ReviewReply {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
}

interface Review {
  id: string;
  image_url: string | null;
  images: string[] | null;
  rating: number;
  content: string;
  author_name: string;
  created_at: string;
  type: string;
  review_replies?: ReviewReply[];
}

interface ReviewStats {
  totalCount: number;
  averageRating: number;
  ratingCounts: { [key: number]: number };
}

export default function ReviewsPage() {
  const { language } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    totalCount: 0,
    averageRating: 0,
    ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [showWriteModal, setShowWriteModal] = useState(false);

  // 비공개 리뷰 확인용
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [unlockedReviews, setUnlockedReviews] = useState<Set<string>>(new Set());
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [selectedRating]);

  const fetchReviews = async () => {
    setLoading(true);

    // 통계용 전체 리뷰 조회 (4~5점만 - 통계는 공개 리뷰만)
    const { data: allReviews } = await supabase
      .from("reviews")
      .select("rating")
      .eq("is_active", true)
      .gte("rating", 4);

    if (allReviews) {
      const totalCount = allReviews.length;
      const ratingCounts: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let totalRating = 0;

      allReviews.forEach((r) => {
        ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
        totalRating += r.rating;
      });

      setStats({
        totalCount,
        averageRating: totalCount > 0 ? totalRating / totalCount : 0,
        ratingCounts,
      });
    }

    // 필터링된 리뷰 조회 (모든 활성 리뷰) - 별점 상관없이 최신순 정렬
    let query = supabase
      .from("reviews")
      .select("*, review_replies(*)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (selectedRating !== null) {
      query = query.eq("rating", selectedRating);
    }

    const { data, error } = await query;

    if (error) {
      console.error("리뷰 조회 실패:", error);
    } else {
      setReviews(data || []);
    }
    setLoading(false);
  };

  const renderStars = (rating: number, size: "sm" | "md" | "lg" = "sm") => {
    const sizeClasses = {
      sm: "w-3 h-3",
      md: "w-4 h-4",
      lg: "w-5 h-5",
    };

    return (
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <svg
            key={i}
            className={`${sizeClasses[size]} ${i < rating ? "text-yellow-400" : "text-gray-300"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (language === "ko") {
      return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    }
    return date.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  };

  const t = {
    title: language === "ko" ? "리뷰" : "レビュー",
    totalReviews: language === "ko" ? "전체 리뷰" : "全てのレビュー",
    writeBtn: language === "ko" ? "리뷰 작성" : "レビューを書く",
    all: language === "ko" ? "전체" : "すべて",
    noReviews: language === "ko" ? "아직 리뷰가 없습니다" : "まだレビューがありません",
    noFilteredReviews: language === "ko"
      ? "해당 별점의 리뷰가 없습니다"
      : "該当する評価のレビューがありません",
    back: language === "ko" ? "홈으로" : "ホームへ",
    shopReply: language === "ko" ? "사장님 답변" : "ショップからの返信",
    privateReview: language === "ko" ? "비공개 리뷰입니다" : "非公開レビューです",
    clickToView: language === "ko" ? "내용을 확인하려면 탭하세요" : "内容を確認するにはタップしてください",
    enterPassword: language === "ko" ? "비밀번호 입력" : "パスワード入力",
    passwordPlaceholder: language === "ko" ? "리뷰 작성 시 입력한 비밀번호" : "レビュー作成時に入力したパスワード",
    confirm: language === "ko" ? "확인" : "確認",
    cancel: language === "ko" ? "취소" : "キャンセル",
    wrongPassword: language === "ko" ? "비밀번호가 일치하지 않습니다" : "パスワードが一致しません",
  };

  // 비공개 리뷰 확인 함수
  const handlePrivateReviewClick = (reviewId: string) => {
    setSelectedReviewId(reviewId);
    setPasswordInput("");
    setPasswordError(false);
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async () => {
    if (!selectedReviewId || !passwordInput.trim()) return;

    const { data, error } = await supabase
      .from("reviews")
      .select("password")
      .eq("id", selectedReviewId)
      .single();

    if (error || !data) {
      setPasswordError(true);
      return;
    }

    if (data.password === passwordInput.trim()) {
      setUnlockedReviews((prev) => new Set(prev).add(selectedReviewId));
      setShowPasswordModal(false);
      setPasswordInput("");
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const isPrivateReview = (review: Review) => review.rating <= 3;
  const isUnlocked = (reviewId: string) => unlockedReviews.has(reviewId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-medium text-gray-900">{t.title}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* 통계 섹션 */}
        <div className="bg-white p-6 border-b border-gray-100">
          <div className="flex items-center gap-6">
            {/* 평균 별점 */}
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900">
                {stats.averageRating.toFixed(1)}
              </div>
              <div className="mt-1">{renderStars(Math.round(stats.averageRating), "md")}</div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.totalCount.toLocaleString()} {language === "ko" ? "개" : "件"}
              </div>
            </div>

            {/* 별점 분포 (4~5점만) */}
            <div className="flex-1 space-y-1">
              {[5, 4].map((star) => {
                const count = stats.ratingCounts[star] || 0;
                const percentage = stats.totalCount > 0 ? (count / stats.totalCount) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-gray-500">{star}</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-gray-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 필터 + 작성 버튼 */}
        <div className="bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setSelectedRating(null)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                selectedRating === null
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.all} ({stats.totalCount})
            </button>
            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                onClick={() => setSelectedRating(star)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors flex items-center gap-1 ${
                  selectedRating === star
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {star}
                <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowWriteModal(true)}
            className="ml-2 px-4 py-1.5 bg-gray-900 text-white text-sm rounded-full hover:bg-gray-800 whitespace-nowrap"
          >
            {t.writeBtn}
          </button>
        </div>

        {/* 리뷰 목록 */}
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {selectedRating !== null ? t.noFilteredReviews : t.noReviews}
            </div>
          ) : (
            reviews.map((review) => {
              const isPrivate = isPrivateReview(review);
              const unlocked = isUnlocked(review.id);
              const showContent = !isPrivate || unlocked;

              return (
                <div key={review.id} className="bg-white p-4">
                  {/* 비공개 리뷰 (잠금 상태) */}
                  {isPrivate && !unlocked ? (
                    <div
                      onClick={() => handlePrivateReviewClick(review.id)}
                      className="cursor-pointer"
                    >
                      {/* 리뷰 헤더 - 별점 없이 날짜와 작성자만 */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-xs text-gray-400">{formatDate(review.created_at)}</span>
                          <p className="text-sm font-medium text-gray-900 mt-1">{review.author_name}</p>
                        </div>
                      </div>

                      {/* 비공개 안내 */}
                      <div className="py-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="text-sm font-medium text-gray-600">{t.privateReview}</p>
                        <p className="text-xs text-gray-400 mt-1">{t.clickToView}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 리뷰 헤더 */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {renderStars(review.rating, "sm")}
                            <span className="text-xs text-gray-400">{formatDate(review.created_at)}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1">{review.author_name}</p>
                        </div>
                      </div>

                      {/* 리뷰 내용 */}
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {review.content}
                      </p>

                      {/* 리뷰 이미지 (배민 스타일 - 여러 장) */}
                      {(() => {
                        const imageList = review.images || (review.image_url ? [review.image_url] : []);
                        if (imageList.length === 0) return null;
                        return (
                          <div className="mt-3 flex gap-2 overflow-x-auto">
                            {imageList.map((url, idx) => (
                              <div key={idx} className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                                <Image
                                  src={url}
                                  alt={`리뷰 이미지 ${idx + 1}`}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* 사장님 답변 */}
                      {review.review_replies && review.review_replies.length > 0 && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg border-l-4 border-gray-900">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-gray-900">
                              {review.review_replies[0].author_name}
                            </span>
                            <span className="px-1.5 py-0.5 bg-gray-900 text-white text-[10px] rounded">
                              {t.shopReply}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {review.review_replies[0].content}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* 리뷰 작성 모달 */}
      <ReviewWriteModal
        isOpen={showWriteModal}
        onClose={() => setShowWriteModal(false)}
        onSuccess={fetchReviews}
      />

      {/* 비밀번호 입력 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t.enterPassword}</h3>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError(false);
              }}
              placeholder={t.passwordPlaceholder}
              className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                passwordError ? "border-red-500" : "border-gray-300"
              }`}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
            />
            {passwordError && (
              <p className="text-xs text-red-500 mt-2">{t.wrongPassword}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordInput("");
                  setPasswordError(false);
                }}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
