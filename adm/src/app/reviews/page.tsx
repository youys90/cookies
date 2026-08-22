"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { translateKoJa } from "@/lib/translate";
import BulkActionBar from "@/components/BulkActionBar";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import ProductPicker from "@/components/ProductPicker";

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
  product_id?: number | null;
  product_ids?: number[] | null;
  product_names?: string[] | null;
  product_images?: string[] | null;
}

interface ProductThumb {
  id: number;
  image: string;
  name: string;
}

type ReviewViewMode = "compact" | "gallery";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  // 뷰 모드 · 상품관리 패턴 참고 · 사장님 취향 localStorage 저장
  // - 목록형(compact): 테이블 · 대량 관리용
  // - 갤러리(gallery): 큰 사진 카드 · 컬럼 수 조절 가능 · 1~2열이면 자동으로 「자세히」 가로 카드
  const [viewMode, setViewMode] = useState<ReviewViewMode>("gallery");
  const [galleryCols, setGalleryCols] = useState<number>(3);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("adm.reviewViewMode") as ReviewViewMode | null;
    if (saved === "compact" || saved === "gallery") setViewMode(saved);
    const savedCols = localStorage.getItem("adm.reviewGalleryCols");
    if (savedCols) {
      const n = Number(savedCols);
      if (Number.isFinite(n) && n >= 1 && n <= 6) setGalleryCols(n);
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("adm.reviewViewMode", viewMode);
  }, [viewMode]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("adm.reviewGalleryCols", String(galleryCols));
  }, [galleryCols]);
  // 리뷰에 붙일 관련 상품 썸네일 (id → {image, name})
  const [productMap, setProductMap] = useState<Map<number, ProductThumb>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [uploading, setUploading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "admin" | "user" | "fake">("all");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<"all" | "pending" | "approved">("all");

  // 승인 대기 개수
  // 주의: is_active=false 는 '승인 대기'와 '관리자 숨김' 모두를 포함할 수 있음.
  // 승인 프로세스는 손님(user) 리뷰와 AI(fake) 리뷰 대상이므로,
  // 관리자(admin) 등록 리뷰의 숨김 상태는 배지 카운트에서 제외한다.
  // (스키마에 approval_status 컬럼이 추가되면 그때 재정비 예정)
  const pendingCount = reviews.filter(
    (r) => !r.is_active && (r.type === "user" || r.type === "fake")
  ).length;

  // 개별 승인/거절
  const approveReview = async (id: string) => {
    const { error } = await supabase
      .from("reviews")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      alert("승인 실패: " + error.message);
      return;
    }
    fetchReviews();
  };

  // 개별 활성 토글 (인라인 · 상품관리 참고)
  const toggleReviewActive = async (id: string, next: boolean) => {
    const { error } = await supabase
      .from("reviews")
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      alert("상태 변경 실패: " + error.message);
      return;
    }
    fetchReviews();
  };

  // 승인 대기 벌크: 선택된 모두 승인
  const bulkApprove = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("reviews")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      alert("일괄 승인 실패: " + error.message);
      return;
    }
    setSelectedIds(new Set());
    fetchReviews();
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 댓글 관련 상태
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyingReview, setReplyingReview] = useState<Review | null>(null);
  const [replyContent, setReplyContent] = useState("");

  // 다중 선택 · 벌크
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  // AI 답변 초안 · 한국어 번역 별도 저장 (관리자용 · 뜻 이해)
  const [aiDrafts, setAiDrafts] = useState<{ tone: string; text: string }[]>([]);
  const [aiDraftsKo, setAiDraftsKo] = useState<string[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  const toggleReviewSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const requestBulkDelete = () => {
    setPendingDeleteIds(Array.from(selectedIds));
    setShowBulkDelete(true);
  };

  const confirmBulkDelete = async () => {
    if (pendingDeleteIds.length === 0) return;
    const { error } = await supabase.from("reviews").delete().in("id", pendingDeleteIds);
    if (error) {
      alert((pendingDeleteIds.length <= 1 ? "삭제 실패: " : "일괄 삭제 실패: ") + error.message);
      return;
    }
    setShowBulkDelete(false);
    setSelectedIds(new Set());
    setPendingDeleteIds([]);
    fetchReviews();
  };

  const handleBulkToggleActive = async (active: boolean) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("reviews")
      .update({ is_active: active })
      .in("id", ids);
    if (error) {
      alert("일괄 상태변경 실패: " + error.message);
      return;
    }
    fetchReviews();
  };

  const generateAiDrafts = async (review: Review) => {
    setLoadingDrafts(true);
    setAiDrafts([]);
    setAiDraftsKo([]);
    try {
      const res = await fetch("/api/ai/review-reply-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: review.rating,
          content: review.content || "",
          language: "ja",
        }),
      });
      const json = await res.json();
      const drafts: Array<{ tone: string; text: string }> = json?.result?.drafts || [];
      setAiDrafts(drafts);
      // 관리자가 뜻 이해할 수 있게 · 각 초안 한국어 번역 병행 (백그라운드)
      if (drafts.length > 0) {
        const koArr = await Promise.all(
          drafts.map((d) => translateKoJa(d.text, "ja", "ko").catch(() => ""))
        );
        setAiDraftsKo(koArr);
      }
    } catch (e) {
      console.error("AI 초안 생성 실패:", e);
    }
    setLoadingDrafts(false);
  };

  // 폼 상태 (관련 상품 필드 추가)
  const [formData, setFormData] = useState({
    images: [] as string[],
    rating: 5,
    content: "",
    author_name: "",
    is_active: true,
    sort_order: 0,
    product_ids: [] as number[],
    product_names: [] as string[],
    product_thumbs: [] as string[], // UI 미리보기용 (DB 저장 X)
  });
  const MAX_IMAGES = 3;

  // 관련 상품 선택 모달
  const [showProductPicker, setShowProductPicker] = useState(false);

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
      setLoading(false);
      return;
    }
    const list = (data as Review[]) || [];
    setReviews(list);

    // 관련 상품 id 모두 수집 → 한 번에 조회 후 map 저장
    const idSet = new Set<number>();
    list.forEach((r) => {
      if (r.product_id) idSet.add(r.product_id);
      if (Array.isArray(r.product_ids)) r.product_ids.forEach((id) => idSet.add(id));
    });
    if (idSet.size > 0) {
      const { data: prods } = await supabase
        .from("products")
        .select("id, image, name")
        .in("id", Array.from(idSet));
      const m = new Map<number, ProductThumb>();
      (prods || []).forEach((p) => m.set(p.id as number, p as ProductThumb));
      setProductMap(m);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_IMAGES - formData.images.length;
    if (remainingSlots <= 0) return;

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    const newUrls: string[] = [];

    for (const file of filesToUpload) {
      const fileExt = file.name.split(".").pop();
      const fileName = `review_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `reviews/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) {
        console.error("이미지 업로드 실패:", uploadError);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      newUrls.push(publicUrlData.publicUrl);
    }

    setFormData({ ...formData, images: [...formData.images, ...newUrls] });
    setUploading(false);

    // 파일 input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setFormData({
      ...formData,
      images: formData.images.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 사진 · 사장님 요구로 필수값 아님 · 사진 없이도 리뷰 등록 가능
    if (!formData.author_name) {
      alert("작성자명을 입력해주세요.");
      return;
    }

    if (editingReview) {
      // 수정
      const { error } = await supabase
        .from("reviews")
        .update({
          images: formData.images,
          image_url: formData.images[0] || null, // 하위 호환성
          rating: formData.rating,
          content: formData.content,
          author_name: formData.author_name,
          is_active: formData.is_active,
          sort_order: formData.sort_order,
          product_id: formData.product_ids[0] || null,
          product_ids: formData.product_ids.length > 0 ? formData.product_ids : null,
          product_names: formData.product_names.length > 0 ? formData.product_names : null,
          product_images: formData.product_thumbs.length > 0 ? formData.product_thumbs : null,
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
        images: formData.images,
        image_url: formData.images[0] || null, // 하위 호환성
        rating: formData.rating,
        content: formData.content,
        author_name: formData.author_name,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
        type: "admin",
        product_id: formData.product_ids[0] || null,
        product_ids: formData.product_ids.length > 0 ? formData.product_ids : null,
        product_names: formData.product_names.length > 0 ? formData.product_names : null,
        product_images: formData.product_thumbs.length > 0 ? formData.product_thumbs : null,
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
      const existingImages = review.images || (review.image_url ? [review.image_url] : []);
      const ids = Array.isArray(review.product_ids) && review.product_ids.length > 0
        ? review.product_ids
        : review.product_id
          ? [review.product_id]
          : [];
      const names = Array.isArray(review.product_names) ? review.product_names : [];
      const thumbs = ids.map((id) => productMap.get(id)?.image || "");
      setFormData({
        images: existingImages,
        rating: review.rating,
        content: review.content || "",
        author_name: review.author_name,
        is_active: review.is_active,
        sort_order: review.sort_order,
        product_ids: ids,
        product_names: names,
        product_thumbs: thumbs,
      });
    } else {
      setEditingReview(null);
      setFormData({
        images: [],
        rating: 5,
        content: "",
        author_name: "",
        is_active: true,
        sort_order: reviews.length,
        product_ids: [],
        product_names: [],
        product_thumbs: [],
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingReview(null);
    setFormData({
      images: [],
      rating: 5,
      content: "",
      author_name: "",
      is_active: true,
      sort_order: 0,
      product_ids: [],
      product_names: [],
      product_thumbs: [],
    });
  };

  // 댓글 등록
  const handleReplySubmit = async () => {
    if (!replyingReview || !replyContent.trim()) return;

    const { error } = await supabase.from("review_replies").insert({
      review_id: replyingReview.id,
      content: replyContent.trim(),
      author_name: "CREAM",
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

  // 댓글 모달 열기 (열면서 자동으로 AI 초안 생성)
  const openReplyModal = (review: Review) => {
    setReplyingReview(review);
    setReplyContent("");
    setAiDrafts([]);
    setShowReplyModal(true);
    generateAiDrafts(review);
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
      {/* Header · 상품관리 스타일 참고 */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-light tracking-wide text-gray-900">
            리뷰 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            메인 페이지 리뷰 슬라이드 관리
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/reviews/bulk-new"
            className="px-4 py-2 bg-white border-2 border-[var(--color-brand)] text-[var(--color-brand-dk)] text-sm font-semibold rounded-lg hover:bg-[var(--color-brand)]/10 transition"
          >
            ⭐ 리뷰 일괄 등록
          </a>
          <button
            onClick={() => openModal()}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
          >
            + 리뷰 등록
          </button>
        </div>
      </div>

      {/* Filters · 상품관리 스타일 흰 카드 · pill 통일 */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col gap-3">
      {/* 뷰 모드 스위처 · 상품관리 스타일 참고 · localStorage 기억 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">보기</span>
        <div className="inline-flex items-center bg-white rounded-full p-0.5 border border-gray-200 shadow-sm" role="group" aria-label="리뷰 뷰 모드 전환">
          <button
            onClick={() => setViewMode("compact")}
            className={`px-3 py-1 text-xs rounded-full transition-all font-medium ${
              viewMode === "compact" ? "bg-[var(--color-brand)] text-white shadow-sm" : "text-gray-500 hover:text-[var(--color-brand-dk)]"
            }`}
            title="목록형 · 한 줄씩 컴팩트하게"
          >
            📋 목록형
          </button>
          <button
            onClick={() => setViewMode("gallery")}
            className={`px-3 py-1 text-xs rounded-full transition-all font-medium ${
              viewMode === "gallery" ? "bg-[var(--color-brand)] text-white shadow-sm" : "text-gray-500 hover:text-[var(--color-brand-dk)]"
            }`}
            title="갤러리 · 큰 이미지 카드 (1~2열이면 자동 자세히)"
          >
            🖼 갤러리
          </button>
        </div>
        {/* 갤러리 뷰 · 한 줄에 몇 개 (customize 스타일 · 숫자 스피너 + 슬라이더) */}
        {viewMode === "gallery" && (
          <div className="flex items-center gap-3 flex-wrap ml-2">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">한 줄에 몇 개?</span>
            <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
              <button
                onClick={() => setGalleryCols((n) => Math.max(1, n - 1))}
                className="px-2 py-1 text-gray-500 hover:bg-gray-50 rounded-l-lg disabled:opacity-30"
                disabled={galleryCols <= 1}
              >▼</button>
              <span className="px-3 py-1 text-sm font-bold text-gray-900 min-w-[30px] text-center">{galleryCols}</span>
              <button
                onClick={() => setGalleryCols((n) => Math.min(6, n + 1))}
                className="px-2 py-1 text-gray-500 hover:bg-gray-50 rounded-r-lg disabled:opacity-30"
                disabled={galleryCols >= 6}
              >▲</button>
              <span className="px-2 py-1 text-[10px] text-gray-400 border-l border-gray-200">개</span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              value={galleryCols}
              onChange={(e) => setGalleryCols(Number(e.target.value))}
              className="w-32 accent-[var(--color-brand)]"
            />
            <span className="text-[10px] text-gray-400">1 ~ 6</span>
            {galleryCols <= 2 && (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">
                📝 자세히 모드
              </span>
            )}
          </div>
        )}
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
        <button
          onClick={() => setTypeFilter("fake")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            typeFilter === "fake"
              ? "bg-purple-600 text-white"
              : "bg-purple-100 text-purple-600 hover:bg-purple-200"
          }`}
        >
          AI 생성 ({reviews.filter((r) => r.type === "fake").length})
        </button>
      </div>

      {/* 승인 상태 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setApprovalFilter("all")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            approvalFilter === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          전체 상태
        </button>
        <button
          onClick={() => setApprovalFilter("pending")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
            approvalFilter === "pending"
              ? "bg-orange-500 text-white"
              : "bg-orange-50 text-orange-700 hover:bg-orange-100"
          }`}
        >
          ⏳ 승인 대기
          {pendingCount > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium ${
              approvalFilter === "pending" ? "bg-white text-orange-600" : "bg-orange-600 text-white"
            }`}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setApprovalFilter("approved")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            approvalFilter === "approved"
              ? "bg-green-600 text-white"
              : "bg-green-50 text-green-700 hover:bg-green-100"
          }`}
        >
          ✓ 노출중
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
        </div>
      </div>

      {/* 리뷰 목록 · viewMode 반영 */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">로딩 중...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          등록된 리뷰가 없습니다.
        </div>
      ) : viewMode === "compact" ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-4 text-center w-12">
                  <input
                    type="checkbox"
                    checked={(() => {
                      const arr = reviews.filter((r) => {
                        if (typeFilter === "admin" && r.type !== "admin" && r.type) return false;
                        if (typeFilter === "user" && r.type !== "user") return false;
                        if (typeFilter === "fake" && r.type !== "fake") return false;
                        if (approvalFilter === "pending" && r.is_active) return false;
                        if (approvalFilter === "approved" && !r.is_active) return false;
                        if (ratingFilter !== null && r.rating !== ratingFilter) return false;
                        return true;
                      });
                      return arr.length > 0 && arr.every((r) => selectedIds.has(r.id));
                    })()}
                    onChange={(e) => {
                      const arr = reviews.filter((r) => {
                        if (typeFilter === "admin" && r.type !== "admin" && r.type) return false;
                        if (typeFilter === "user" && r.type !== "user") return false;
                        if (typeFilter === "fake" && r.type !== "fake") return false;
                        if (approvalFilter === "pending" && r.is_active) return false;
                        if (approvalFilter === "approved" && !r.is_active) return false;
                        if (ratingFilter !== null && r.rating !== ratingFilter) return false;
                        return true;
                      });
                      if (e.target.checked) setSelectedIds(new Set([...selectedIds, ...arr.map((r) => r.id)]));
                      else setSelectedIds(new Set(Array.from(selectedIds).filter((id) => !arr.some((r) => r.id === id))));
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 tracking-wider w-20">사진</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 tracking-wider w-24">별점</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">내용</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">작성자</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">관련 상품</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">상태</th>
                <th className="px-4 py-4 text-center text-xs font-medium text-gray-500 tracking-wider border-l border-gray-100">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reviews
                .filter((review) => {
                  if (typeFilter === "admin" && review.type !== "admin" && review.type) return false;
                  if (typeFilter === "user" && review.type !== "user") return false;
                  if (typeFilter === "fake" && review.type !== "fake") return false;
                  if (approvalFilter === "pending" && review.is_active) return false;
                  if (approvalFilter === "approved" && !review.is_active) return false;
                  if (ratingFilter !== null && review.rating !== ratingFilter) return false;
                  return true;
                })
                .map((review) => {
                  const thumb = review.images?.[0] || review.image_url;
                  const checked = selectedIds.has(review.id);
                  return (
                    <tr key={review.id} className={`hover:bg-gray-50 ${checked ? "bg-yellow-50 hover:bg-yellow-100" : ""} ${!review.is_active ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleReviewSelect(review.id)}
                          className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {thumb ? (
                          <div className="relative w-14 h-14 rounded overflow-hidden border border-gray-200">
                            <Image src={thumb} alt="" fill unoptimized className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 bg-gray-100 rounded flex items-center justify-center text-gray-300 text-[10px]">없음</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-amber-400 text-sm whitespace-nowrap font-semibold">{"★".repeat(review.rating)}<span className="text-gray-300">{"★".repeat(5 - review.rating)}</span></td>
                      <td className="px-6 py-3 text-sm text-gray-700 max-w-md truncate">{review.content || <span className="text-gray-300">(내용 없음)</span>}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{review.author_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {Array.isArray(review.product_ids) && review.product_ids.length > 0 ? (
                          <span>{review.product_ids.length}건</span>
                        ) : review.product_id ? "1건" : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {/* 상태 pill · 클릭 시 토글 (상품관리 참고) */}
                        <button
                          onClick={() => toggleReviewActive(review.id, !review.is_active)}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition hover:brightness-95 ${
                            review.is_active
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                          }`}
                          title={review.is_active ? "클릭 시 비노출" : "클릭 시 노출중으로"}
                        >
                          {review.is_active ? "✓ 노출중" : "⏳ 승인 대기"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center border-l border-gray-100 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => openModal(review)} className="px-2 py-1 text-[10px] text-gray-700 border border-gray-200 rounded hover:bg-gray-50" title="수정">✎ 수정</button>
                          <button
                            onClick={() => openReplyModal(review)}
                            className="px-2 py-1 text-[10px] text-purple-700 border border-purple-200 rounded hover:bg-purple-50"
                            title="댓글 작성 (AI 답변 초안 포함)"
                          >💬 답변</button>
                          <button onClick={() => { setPendingDeleteIds([review.id]); setShowBulkDelete(true); }} className="px-2 py-1 text-[10px] text-red-500 border border-red-200 rounded hover:bg-red-50" title="이 리뷰 삭제">🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(6, galleryCols))}, minmax(0, 1fr))` }}
        >
          {reviews
            .filter((review) => {
              // 타입 필터
              if (typeFilter === "admin" && review.type !== "admin" && review.type) return false;
              if (typeFilter === "user" && review.type !== "user") return false;
              if (typeFilter === "fake" && review.type !== "fake") return false;
              // 승인 상태 필터
              if (approvalFilter === "pending" && review.is_active) return false;
              if (approvalFilter === "approved" && !review.is_active) return false;
              // 별점 필터
              if (ratingFilter !== null && review.rating !== ratingFilter) return false;
              return true;
            })
            .map((review) => (
            <div
              key={review.id}
              className={`bg-white rounded-xl shadow-sm overflow-hidden relative ${
                !review.is_active ? "opacity-50" : ""
              } ${selectedIds.has(review.id) ? "ring-2 ring-yellow-400" : ""}`}
            >
              {/* 다중 선택 체크박스 */}
              <label className="absolute top-2 left-2 z-10 w-6 h-6 bg-white/85 backdrop-blur-sm rounded flex items-center justify-center cursor-pointer shadow-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.has(review.id)}
                  onChange={() => toggleReviewSelect(review.id)}
                  className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                  aria-label={`${review.author_name} 선택`}
                />
              </label>
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
                  review.type === "user" ? "bg-blue-500" : review.type === "fake" ? "bg-purple-500" : "bg-gray-600"
                }`}>
                  {review.type === "user" ? "사용자" : review.type === "fake" ? "AI" : "관리자"}
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

                {/* 관련 상품 썸네일 (판석이형 4-2) */}
                {(() => {
                  const ids: number[] = Array.isArray(review.product_ids) && review.product_ids.length > 0
                    ? review.product_ids
                    : review.product_id
                      ? [review.product_id]
                      : [];
                  if (ids.length === 0) return null;
                  return (
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      {ids.slice(0, 4).map((pid) => {
                        const p = productMap.get(pid);
                        if (!p) return (
                          <div key={pid} className="w-9 h-9 bg-gray-100 rounded flex items-center justify-center text-[9px] text-gray-400" title={`#${pid} (삭제됨?)`}>?</div>
                        );
                        return (
                          <div key={pid} className="relative w-9 h-9 bg-gray-100 rounded overflow-hidden border border-gray-200" title={p.name}>
                            <Image src={p.image} alt={p.name} fill className="object-cover" unoptimized />
                          </div>
                        );
                      })}
                      {ids.length > 4 && (
                        <span className="text-[10px] text-gray-400">+{ids.length - 4}</span>
                      )}
                    </div>
                  );
                })()}

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
                {!review.is_active && (
                  <button
                    onClick={() => approveReview(review.id)}
                    className="flex-1 py-2 text-xs rounded-lg bg-orange-500 text-white hover:bg-orange-600 font-medium"
                    title="승인 후 노출"
                  >
                    ⏳→✓ 승인
                  </button>
                )}
                <button
                  onClick={() => handleToggleActive(review)}
                  className={`flex-1 py-2 text-xs rounded-lg ${
                    review.is_active
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : "bg-green-100 text-green-600 hover:bg-green-200"
                  }`}
                  title={
                    review.is_active
                      ? "메인 페이지에서 숨김"
                      : "승인 없이 즉시 노출"
                  }
                >
                  {review.is_active ? "숨기기" : "노출하기"}
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
              {/* 이미지 업로드 (최대 3장) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  리뷰 이미지 (최대 {MAX_IMAGES}장)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  {formData.images.map((url, index) => (
                    <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={url}
                        alt={`리뷰 이미지 ${index + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black bg-opacity-60 rounded-full flex items-center justify-center"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {formData.images.length < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500"
                    >
                      {uploading ? (
                        <span className="text-xs">업로드중...</span>
                      ) : (
                        <>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="text-xs mt-1">{formData.images.length}/{MAX_IMAGES}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 관련 상품 (판석이형 4-2 + 4-4) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    관련 상품 <span className="text-gray-400 font-normal">({formData.product_ids.length}개)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowProductPicker(true)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    + 상품 선택
                  </button>
                </div>
                {formData.product_ids.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowProductPicker(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600"
                  >
                    이 리뷰가 어떤 상품에 대한 것인지 선택 (선택사항)
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {formData.product_ids.map((pid, i) => (
                      <span key={pid} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                        {formData.product_thumbs[i] && (
                          <span className="relative w-6 h-6 bg-white rounded overflow-hidden">
                            <Image src={formData.product_thumbs[i]} alt="" fill className="object-cover" unoptimized />
                          </span>
                        )}
                        <span className="max-w-[140px] truncate">{formData.product_names[i] || `#${pid}`}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              product_ids: prev.product_ids.filter((_, k) => k !== i),
                              product_names: prev.product_names.filter((_, k) => k !== i),
                              product_thumbs: prev.product_thumbs.filter((_, k) => k !== i),
                            }));
                          }}
                          className="text-blue-500 hover:text-blue-800 leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
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
                  작성자명
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

      {/* 벌크 액션 바 · 상품관리 스타일 (노출/숨김 · 일괄 수정 · 삭제) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-800 flex items-center gap-1 px-3 py-2 max-w-[95vw] overflow-x-auto">
          <div className="flex items-center gap-2 pr-3 border-r border-gray-700">
            <span className="text-sm">
              <span className="font-medium">{selectedIds.size}개</span> 선택됨
            </span>
          </div>
          <button
            onClick={() => handleBulkToggleActive(true)}
            className="px-3 py-1.5 text-xs rounded hover:bg-gray-800 transition"
            title="선택 항목을 노출중(=승인)으로"
          >
            노출 ↑
          </button>
          <button
            onClick={() => handleBulkToggleActive(false)}
            className="px-3 py-1.5 text-xs rounded hover:bg-gray-800 transition"
            title="선택 항목을 숨김으로"
          >
            숨김 ↓
          </button>
          <button
            onClick={() => {
              const ids = Array.from(selectedIds).join(",");
              window.location.href = `/reviews/bulk-edit?ids=${ids}`;
            }}
            className="px-3 py-1.5 text-xs rounded bg-amber-500 hover:bg-amber-600 transition font-medium"
            title="선택 항목 일괄 수정"
          >
            ✏️ 일괄 수정
          </button>
          <button
            onClick={requestBulkDelete}
            className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500 transition"
          >
            삭제
          </button>
          <div className="pl-2 border-l border-gray-700 ml-1">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 transition"
              aria-label="선택 해제"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 벌크 삭제 확인 모달 */}
      <DeleteConfirmModal
        open={showBulkDelete}
        count={pendingDeleteIds.length}
        onClose={() => {
          setShowBulkDelete(false);
          setPendingDeleteIds([]);
        }}
        onConfirm={confirmBulkDelete}
        title={pendingDeleteIds.length <= 1 ? "리뷰 삭제" : `리뷰 ${pendingDeleteIds.length}건 일괄 삭제`}
      />

      {/* 관련 상품 선택 모달 */}
      <ProductPicker
        open={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        initialSelectedIds={formData.product_ids}
        onConfirm={(products) => {
          setFormData((prev) => ({
            ...prev,
            product_ids: products.map((p) => p.id),
            product_names: products.map((p) => p.name_ja || p.name),
            product_thumbs: products.map((p) => p.image),
          }));
        }}
      />

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

              {/* AI 답변 초안 (자동 생성) */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-purple-700">
                    ✨ AI 답변 초안
                    {loadingDrafts && <span className="ml-2 text-gray-400 font-normal">생성 중…</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => generateAiDrafts(replyingReview)}
                    disabled={loadingDrafts}
                    className="text-xs text-purple-600 hover:text-purple-800 disabled:opacity-50"
                  >
                    다시 생성
                  </button>
                </div>
                {aiDrafts.length > 0 && (
                  <div className="space-y-1.5">
                    {aiDrafts.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setReplyContent(d.text)}
                        className="w-full text-left px-3 py-2 text-xs bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-lg transition"
                        title="클릭해서 이 초안 사용"
                      >
                        <div className="flex items-start gap-1.5">
                          <span className="inline-block px-1.5 py-0.5 text-[10px] bg-purple-600 text-white rounded uppercase font-semibold flex-shrink-0">
                            {d.tone}
                          </span>
                          <span className="text-gray-800 flex-1">{d.text}</span>
                        </div>
                        {/* 관리자용 한국어 뜻 · 클릭 시 사용될 원문(일본어) 아래 참고용 */}
                        {aiDraftsKo[i] && (
                          <div className="mt-1.5 pt-1.5 border-t border-purple-200/60 flex items-start gap-1.5">
                            <span className="inline-block px-1.5 py-0.5 text-[10px] bg-gray-200 text-gray-700 rounded font-semibold flex-shrink-0">🇰🇷 KO</span>
                            <span className="text-gray-600 flex-1 italic">{aiDraftsKo[i]}</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {!loadingDrafts && aiDrafts.length === 0 && (
                  <p className="text-xs text-gray-400 italic">초안 생성 실패 또는 없음</p>
                )}
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
