"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  option_name: string | null;
}

interface ReviewWriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewWriteModal({ isOpen, onClose, onSuccess }: ReviewWriteModalProps) {
  const { language } = useLanguage();
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [password, setPassword] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_IMAGES = 3;

  // 주문내역 연동
  const [lineName, setLineName] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<OrderItem | null>(null);
  const [searchingOrders, setSearchingOrders] = useState(false);
  const [orderSearched, setOrderSearched] = useState(false);

  if (!isOpen) return null;

  const t = {
    title: language === "ko" ? "리뷰 작성" : "レビューを書く",
    ratingLabel: language === "ko" ? "별점" : "評価",
    contentLabel: language === "ko" ? "리뷰 내용" : "レビュー内容",
    contentPlaceholder: language === "ko"
      ? "상품에 대한 솔직한 후기를 남겨주세요"
      : "商品についての感想をお聞かせください",
        passwordLabel: language === "ko" ? "비밀번호" : "パスワード",
    passwordPlaceholder: language === "ko" ? "리뷰 수정/삭제 시 필요" : "レビューの修正・削除時に必要",
    passwordRequired: language === "ko" ? "비밀번호를 입력해주세요." : "パスワードを入力してください。",
    imageLabel: language === "ko" ? "사진 첨부 (최대 3장)" : "写真を添付（最大3枚）",
    uploadBtn: language === "ko" ? "사진 추가" : "写真を追加",
    uploading: language === "ko" ? "업로드 중..." : "アップロード中...",
    cancel: language === "ko" ? "취소" : "キャンセル",
    submit: language === "ko" ? "등록하기" : "投稿する",
    submitting: language === "ko" ? "등록 중..." : "投稿中...",
    successMsg: language === "ko" ? "리뷰가 등록되었습니다!" : "レビューが投稿されました！",
    errorMsg: language === "ko" ? "등록에 실패했습니다." : "投稿に失敗しました。",
        contentRequired: language === "ko" ? "리뷰 내용을 입력해주세요." : "レビュー内容を入力してください。",
    imageRequired: language === "ko" ? "사진을 첨부해주세요." : "写真を添付してください。",
    lineNameLabel: language === "ko" ? "LINE NAME" : "LINE NAME",
    lineNamePlaceholder: language === "ko" ? "주문 시 입력한 LINE ID" : "注文時に入力したLINE ID",
    searchOrders: language === "ko" ? "조회" : "検索",
    searching: language === "ko" ? "조회 중..." : "検索中...",
    productLabel: language === "ko" ? "구매 상품" : "購入商品",
    productRequired: language === "ko" ? "상품을 선택해주세요." : "商品を選択してください。",
    noOrders: language === "ko" ? "주문 내역이 없습니다." : "注文履歴がありません。",
    lineNameRequired: language === "ko" ? "LINE NAME을 입력해주세요." : "LINE NAMEを入力してください。",
  };

  // LINE NAME으로 주문내역 조회 (이미 리뷰 작성한 상품 제외)
  const searchOrdersByLineName = async () => {
    if (!lineName.trim()) {
      alert(t.lineNameRequired);
      return;
    }

    setSearchingOrders(true);
    setOrderSearched(true);
    setOrderItems([]);
    setSelectedProduct(null);

    // 1. 해당 LINE NAME으로 이미 작성한 리뷰의 product_id 조회
    // 마스킹 패턴: 4자 이상은 앞 3자 + ***, 3자 이하는 마지막 1글자만 *
    const maskedPattern = lineName.trim().length > 3
      ? lineName.trim().slice(0, 3) + "***"
      : lineName.trim().length > 1
        ? lineName.trim().slice(0, -1) + "*"
        : "*";

    const { data: existingReviews } = await supabase
      .from("reviews")
      .select("product_id")
      .eq("author_name", maskedPattern)
      .eq("type", "user");

    const reviewedProductIds = new Set(
      existingReviews?.map((r) => r.product_id).filter(Boolean) || []
    );

    // 2. 주문내역 조회
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        order_items (
          id,
          product_id,
          product_name,
          product_image,
          option_name
        )
      `)
      .ilike("customer_line", lineName.trim())
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("주문 조회 에러:", error);
    } else if (data) {
      // 주문 상품들을 평탄화 (중복 제거 + 이미 리뷰 작성한 상품 제외)
      const items: OrderItem[] = [];
      const seenProducts = new Set<string>();

      data.forEach((order) => {
        (order.order_items as OrderItem[] | null)?.forEach((item) => {
          const key = `${item.product_id}_${item.option_name || ""}`;
          // 이미 리뷰 작성한 상품은 제외
          if (!seenProducts.has(key) && !reviewedProductIds.has(item.product_id)) {
            seenProducts.add(key);
            items.push(item);
          }
        });
      });

      setOrderItems(items);
    }

    setSearchingOrders(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_IMAGES - imageUrls.length;
    if (remainingSlots <= 0) return;

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    const newUrls: string[] = [];

    for (const file of filesToUpload) {
      const fileExt = file.name.split(".").pop();
      const fileName = `user_review_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
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

    setImageUrls((prev) => [...prev, ...newUrls]);
    setUploading(false);

    // 파일 input 초기화 (같은 파일 다시 선택 가능하게)
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) {
      alert(t.productRequired);
      return;
    }
    if (imageUrls.length === 0) {
      alert(t.imageRequired);
      return;
    }
    if (!lineName.trim()) {
      alert(t.lineNameRequired);
      return;
    }
    if (!password.trim()) {
      alert(t.passwordRequired);
      return;
    }
    if (!content.trim()) {
      alert(t.contentRequired);
      return;
    }

    setSubmitting(true);

    // LINE NAME 마스킹
    // 4자 이상: 앞 3자리만 노출 + *** (예: cookies_lover → coo***)
    // 3자 이하: 마지막 1글자만 마스킹 (예: abc → ab*, ab → a*, a → *)
    const maskedName = lineName.length > 3
      ? lineName.slice(0, 3) + "***"
      : lineName.length > 1
        ? lineName.slice(0, -1) + "*"
        : "*";

    // 별점 1~3점: 바로 노출되지만 내용은 비공개 (비밀번호로 확인) + 자동 댓글 예약
    // 별점 4~5점: 바로 노출 (공개)
    const isLowRating = rating <= 3;

    // 1~3점일 경우 15~60분 뒤 자동 댓글 예약
    let autoReplyAt = null;
    if (isLowRating) {
      const delayMinutes = Math.floor(Math.random() * 46) + 15; // 15~60분
      autoReplyAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    }

    const { error } = await supabase.from("reviews").insert({
      images: imageUrls.length > 0 ? imageUrls : null,
      rating,
      content: content.trim(),
      author_name: maskedName,
      password: password.trim(),
      type: "user",
      is_active: true, // 모든 리뷰 바로 노출 (1~3점은 내용만 비공개)
      sort_order: 999, // 사용자 리뷰는 뒤쪽에 정렬
      auto_reply_at: autoReplyAt,
      product_id: selectedProduct.product_id,
    });

    setSubmitting(false);

    if (error) {
      console.error("리뷰 등록 실패:", error);
      alert(t.errorMsg);
      return;
    }

    alert(t.successMsg);
    resetForm();
    onSuccess();
    onClose();
  };

  const resetForm = () => {
    setRating(5);
    setContent("");
    setPassword("");
    setImageUrls([]);
    setLineName("");
    setOrderItems([]);
    setSelectedProduct(null);
    setOrderSearched(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white p-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">{t.title}</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* LINE NAME 입력 + 주문 조회 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.lineNameLabel} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={lineName}
                onChange={(e) => setLineName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchOrdersByLineName())}
                placeholder={t.lineNamePlaceholder}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                type="button"
                onClick={searchOrdersByLineName}
                disabled={searchingOrders}
                className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:bg-gray-400 whitespace-nowrap"
              >
                {searchingOrders ? t.searching : t.searchOrders}
              </button>
            </div>
          </div>

          {/* 구매 상품 선택 */}
          {orderSearched && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.productLabel} <span className="text-red-500">*</span>
              </label>
              {orderItems.length === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">{t.noOrders}</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {orderItems.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedProduct?.id === item.id
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="product"
                        checked={selectedProduct?.id === item.id}
                        onChange={() => setSelectedProduct(item)}
                        className="sr-only"
                      />
                      {item.product_image && (
                        <div className="relative w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                          <Image
                            src={item.product_image}
                            alt={item.product_name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                        {item.option_name && (
                          <p className="text-xs text-gray-500 truncate">{item.option_name}</p>
                        )}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedProduct?.id === item.id
                          ? "border-gray-900 bg-gray-900"
                          : "border-gray-300"
                      }`}>
                        {selectedProduct?.id === item.id && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 별점 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.ratingLabel}
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="focus:outline-none"
                >
                  <svg
                    className={`w-8 h-8 ${star <= rating ? "text-yellow-400" : "text-gray-300"}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.passwordLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPlaceholder}
              maxLength={20}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* 리뷰 내용 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.contentLabel} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.contentPlaceholder}
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{content.length}/500</p>
          </div>

          {/* 이미지 업로드 (최대 3장) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.imageLabel} <span className="text-red-500">*</span>
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
              {imageUrls.map((url, index) => (
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
              {imageUrls.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500"
                >
                  {uploading ? (
                    <span className="text-xs">{t.uploading}</span>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-xs mt-1">{imageUrls.length}/{MAX_IMAGES}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
