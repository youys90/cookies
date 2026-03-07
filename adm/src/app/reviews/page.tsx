"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

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
  is_active: boolean;
  sort_order: number;
  type: "admin" | "user" | "fake";
  auto_reply_at: string | null;
  created_at: string;
  review_replies?: ReviewReply[];
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [uploading, setUploading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "admin" | "user">("all");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 댓글 관련 상태
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyingReview, setReplyingReview] = useState<Review | null>(null);
  const [replyContent, setReplyContent] = useState("");

  // 폼 상태
  const [formData, setFormData] = useState({
    image_url: "",
    rating: 5,
    content: "",
    author_name: "",
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reviews")
      .select("*, review_replies(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("리뷰 조회 실패:", error);
    } else {
      setReviews(data || []);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `review_${Date.now()}.${fileExt}`;
    const filePath = `reviews/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file);

    if (uploadError) {
      console.error("이미지 업로드 실패:", uploadError);
      alert("이미지 업로드에 실패했습니다.");
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    setFormData({ ...formData, image_url: publicUrlData.publicUrl });
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.image_url) {
      alert("이미지를 업로드해주세요.");
      return;
    }
    if (!formData.author_name) {
      alert("작성자명을 입력해주세요.");
      return;
    }

    if (editingReview) {
      // 수정
      const { error } = await supabase
        .from("reviews")
        .update({
          image_url: formData.image_url,
          rating: formData.rating,
          content: formData.content,
          author_name: formData.author_name,
          is_active: formData.is_active,
          sort_order: formData.sort_order,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingReview.id);

      if (error) {
        console.error("리뷰 수정 실패:", error);
        alert("리뷰 수정에 실패했습니다.");
        return;
      }
    } else {
      // 등록
      const { error } = await supabase.from("reviews").insert({
        image_url: formData.image_url,
        rating: formData.rating,
        content: formData.content,
        author_name: formData.author_name,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
      });

      if (error) {
        console.error("리뷰 등록 실패:", error);
        alert("리뷰 등록에 실패했습니다.");
        return;
      }
    }

    closeModal();
    fetchReviews();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    const { error } = await supabase.from("reviews").delete().eq("id", id);

    if (error) {
      console.error("리뷰 삭제 실패:", error);
      alert("리뷰 삭제에 실패했습니다.");
      return;
    }

    fetchReviews();
  };

  const handleToggleActive = async (review: Review) => {
    const { error } = await supabase
      .from("reviews")
      .update({ is_active: !review.is_active })
      .eq("id", review.id);

    if (error) {
      console.error("상태 변경 실패:", error);
      return;
    }

    fetchReviews();
  };

  const openModal = (review?: Review) => {
    if (review) {
      setEditingReview(review);
      setFormData({
        image_url: review.image_url || "",
        rating: review.rating,
        content: review.content || "",
        author_name: review.author_name,
        is_active: review.is_active,
        sort_order: review.sort_order,
      });
    } else {
      setEditingReview(null);
      setFormData({
        image_url: "",
        rating: 5,
        content: "",
        author_name: "",
        is_active: true,
        sort_order: reviews.length,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingReview(null);
    setFormData({
      image_url: "",
      rating: 5,
      content: "",
      author_name: "",
      is_active: true,
      sort_order: 0,
    });
  };

  // 댓글 등록
  const handleReplySubmit = async () => {
    if (!replyingReview || !replyContent.trim()) return;

    const { error } = await supabase.from("review_replies").insert({
      review_id: replyingReview.id,
      content: replyContent.trim(),
      author_name: "Cookies",
    });

    if (error) {
      console.error("댓글 등록 실패:", error);
      alert("댓글 등록에 실패했습니다.");
      return;
    }

    // 자동 댓글 예약 취소 (수동으로 달았으니까)
    await supabase
      .from("reviews")
      .update({ auto_reply_at: null })
      .eq("id", replyingReview.id);

    setShowReplyModal(false);
    setReplyingReview(null);
    setReplyContent("");
    fetchReviews();
  };

  // 댓글 삭제
  const handleDeleteReply = async (replyId: string) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;

    const { error } = await supabase
      .from("review_replies")
      .delete()
      .eq("id", replyId);

    if (error) {
      console.error("댓글 삭제 실패:", error);
      alert("댓글 삭제에 실패했습니다.");
      return;
    }

    fetchReviews();
  };

  // 댓글 모달 열기
  const openReplyModal = (review: Review) => {
    setReplyingReview(review);
    setReplyContent("");
    setShowReplyModal(true);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={`w-4 h-4 ${i < rating ? "text-yellow-400" : "text-gray-300"}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-wide text-gray-900">
            리뷰 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            메인 페이지 리뷰 슬라이드 관리
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
        >
          + 리뷰 등록
        </button>
      </div>

      {/* 필터 탭 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setTypeFilter("all")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            typeFilter === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          전체 ({reviews.length})
        </button>
        <button
          onClick={() => setTypeFilter("admin")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            typeFilter === "admin"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          관리자 등록 ({reviews.filter((r) => r.type === "admin" || !r.type).length})
        </button>
        <button
          onClick={() => setTypeFilter("user")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            typeFilter === "user"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          사용자 작성 ({reviews.filter((r) => r.type === "user").length})
        </button>
      </div>

      {/* 별점 필터 */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setRatingFilter(null)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            ratingFilter === null
              ? "bg-yellow-500 text-white"
              : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
          }`}
        >
          별점 전체
        </button>
        {[5, 4, 3, 2, 1].map((star) => (
          <button
            key={star}
            onClick={() => setRatingFilter(star)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
              ratingFilter === star
                ? "bg-yellow-500 text-white"
                : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
            }`}
          >
            {star}
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            ({reviews.filter((r) => r.rating === star).length})
          </button>
        ))}
      </div>

      {/* 리뷰 목록 */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">로딩 중...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          등록된 리뷰가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews
            .filter((review) => {
              // 타입 필터
              if (typeFilter === "admin" && review.type !== "admin" && review.type) return false;
              if (typeFilter === "user" && review.type !== "user") return false;
              // 별점 필터
              if (ratingFilter !== null && review.rating !== ratingFilter) return false;
              return true;
            })
            .map((review) => (
            <div
              key={review.id}
              className={`bg-white rounded-xl shadow-sm overflow-hidden ${
                !review.is_active ? "opacity-50" : ""
              }`}
            >
              {/* 이미지 (images 배열 우선, 없으면 image_url) */}
              {(() => {
                const thumbnailUrl = review.images?.[0] || review.image_url;
                if (!thumbnailUrl) return <div className="aspect-[4/3] bg-gray-200 flex items-center justify-center text-gray-400 text-sm">이미지 없음</div>;
                return (
              <div className="relative aspect-[4/3] bg-gray-100">
                <Image
                  src={thumbnailUrl}
                  alt={review.author_name}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {/* 순서 배지 */}
                <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  순서: {review.sort_order}
                </div>
                {/* 타입 배지 */}
                <div className={`absolute top-2 right-2 text-white text-xs px-2 py-1 rounded ${
                  review.type === "user" ? "bg-blue-500" : "bg-gray-600"
                }`}>
                  {review.type === "user" ? "사용자" : "관리자"}
                </div>
                {/* 상태 배지 */}
                {!review.is_active && (
                  <div className="absolute top-8 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    비노출
                  </div>
                )}
                {/* 이미지 개수 표시 */}
                {review.images && review.images.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                    +{review.images.length - 1}
                  </div>
                )}
              </div>
                );
              })()}

              {/* 내용 */}
              <div className="p-4">
                <div className="flex items-center mb-2">
                  {renderStars(review.rating)}
                </div>
                {review.content && (
                  <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                    "{review.content}"
                  </p>
                )}
                <p className="text-xs text-gray-500">- {review.author_name}</p>

                {/* 자동 댓글 대기 표시 */}
                {review.auto_reply_at && (
                  <div className="mt-2 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                    ⏰ 자동 댓글 예약: {new Date(review.auto_reply_at).toLocaleString("ko-KR")}
                  </div>
                )}

                {/* 댓글 표시 */}
                {review.review_replies && review.review_replies.length > 0 ? (
                  <div className="mt-2 p-2 bg-gray-50 rounded border-l-2 border-gray-300">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-500">↳ {review.review_replies[0].author_name}</p>
                      <button
                        onClick={() => handleDeleteReply(review.review_replies![0].id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{review.review_replies[0].content}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => openReplyModal(review)}
                    className="mt-2 w-full py-1.5 text-xs text-gray-500 border border-dashed border-gray-300 rounded hover:bg-gray-50"
                  >
                    + 댓글 달기
                  </button>
                )}
              </div>

              {/* 액션 */}
              <div className="px-4 pb-4 flex gap-2">
                <button
                  onClick={() => handleToggleActive(review)}
                  className={`flex-1 py-2 text-xs rounded-lg ${
                    review.is_active
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : "bg-green-100 text-green-600 hover:bg-green-200"
                  }`}
                >
                  {review.is_active ? "숨기기" : "노출"}
                </button>
                <button
                  onClick={() => openModal(review)}
                  className="flex-1 py-2 text-xs bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(review.id)}
                  className="flex-1 py-2 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-medium">
                {editingReview ? "리뷰 수정" : "리뷰 등록"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* 이미지 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  리뷰 이미지 <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {formData.image_url ? (
                  <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                    <Image
                      src={formData.image_url}
                      alt="리뷰 이미지"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black bg-opacity-40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    >
                      이미지 변경
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full aspect-[4/3] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500 hover:border-gray-400"
                  >
                    {uploading ? "업로드 중..." : "클릭하여 이미지 업로드"}
                  </button>
                )}
              </div>

              {/* 별점 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  별점
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className="focus:outline-none"
                    >
                      <svg
                        className={`w-8 h-8 ${
                          star <= formData.rating
                            ? "text-yellow-400"
                            : "text-gray-300"
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* 리뷰 내용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  리뷰 내용
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={3}
                  placeholder="리뷰 내용을 입력하세요 (선택)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* 작성자명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  작성자명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.author_name}
                  onChange={(e) =>
                    setFormData({ ...formData, author_name: e.target.value })
                  }
                  placeholder="예: 홍*동"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* 정렬 순서 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  정렬 순서 (낮을수록 먼저)
                </label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sort_order: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* 노출 여부 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  메인 페이지에 노출
                </label>
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  {editingReview ? "수정" : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 댓글 작성 모달 */}
      {showReplyModal && replyingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-medium">댓글 작성</h2>
              <p className="text-sm text-gray-500 mt-1">
                {replyingReview.author_name}님의 리뷰에 답변
              </p>
            </div>

            <div className="p-4">
              {/* 원본 리뷰 미리보기 */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-1 mb-1">
                  {renderStars(replyingReview.rating)}
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  "{replyingReview.content}"
                </p>
              </div>

              {/* 댓글 입력 */}
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={4}
                placeholder="답변 내용을 입력하세요..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />

              {/* 버튼 */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowReplyModal(false);
                    setReplyingReview(null);
                    setReplyContent("");
                  }}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleReplySubmit}
                  disabled={!replyContent.trim()}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
