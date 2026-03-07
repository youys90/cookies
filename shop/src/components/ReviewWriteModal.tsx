"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReviewWriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewWriteModal({ isOpen, onClose, onSuccess }: ReviewWriteModalProps) {
  const { language } = useLanguage();
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [password, setPassword] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const t = {
    title: language === "ko" ? "리뷰 작성" : "レビューを書く",
    ratingLabel: language === "ko" ? "별점" : "評価",
    contentLabel: language === "ko" ? "리뷰 내용" : "レビュー内容",
    contentPlaceholder: language === "ko"
      ? "상품에 대한 솔직한 후기를 남겨주세요"
      : "商品についての感想をお聞かせください",
    nameLabel: language === "ko" ? "닉네임" : "ニックネーム",
    namePlaceholder: language === "ko" ? "예: 홍길동" : "例: 田中太郎",
    passwordLabel: language === "ko" ? "비밀번호" : "パスワード",
    passwordPlaceholder: language === "ko" ? "리뷰 수정/삭제 시 필요" : "レビューの修正・削除時に必要",
    passwordRequired: language === "ko" ? "비밀번호를 입력해주세요." : "パスワードを入力してください。",
    imageLabel: language === "ko" ? "사진 첨부 (선택)" : "写真を添付（任意）",
    uploadBtn: language === "ko" ? "사진 선택" : "写真を選択",
    uploading: language === "ko" ? "업로드 중..." : "アップロード中...",
    cancel: language === "ko" ? "취소" : "キャンセル",
    submit: language === "ko" ? "등록하기" : "投稿する",
    submitting: language === "ko" ? "등록 중..." : "投稿中...",
    successMsg: language === "ko" ? "리뷰가 등록되었습니다!" : "レビューが投稿されました！",
    errorMsg: language === "ko" ? "등록에 실패했습니다." : "投稿に失敗しました。",
    nameRequired: language === "ko" ? "닉네임을 입력해주세요." : "ニックネームを入力してください。",
    contentRequired: language === "ko" ? "리뷰 내용을 입력해주세요." : "レビュー内容を入力してください。",
    imageRequired: language === "ko" ? "사진을 첨부해주세요." : "写真を添付してください。",
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `user_review_${Date.now()}.${fileExt}`;
    const filePath = `reviews/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file);

    if (uploadError) {
      console.error("이미지 업로드 실패:", uploadError);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    setImageUrl(publicUrlData.publicUrl);
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageUrl) {
      alert(t.imageRequired);
      return;
    }
    if (!authorName.trim()) {
      alert(t.nameRequired);
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

    // 닉네임 마스킹 (예: 홍길동 → 홍*동)
    const maskedName = authorName.length > 2
      ? authorName[0] + "*".repeat(authorName.length - 2) + authorName[authorName.length - 1]
      : authorName.length === 2
        ? authorName[0] + "*"
        : authorName;

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
      image_url: imageUrl || null,
      rating,
      content: content.trim(),
      author_name: maskedName,
      password: password.trim(),
      type: "user",
      is_active: true, // 모든 리뷰 바로 노출 (1~3점은 내용만 비공개)
      sort_order: 999, // 사용자 리뷰는 뒤쪽에 정렬
      auto_reply_at: autoReplyAt,
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
    setAuthorName("");
    setPassword("");
    setImageUrl("");
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

          {/* 닉네임 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.nameLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder={t.namePlaceholder}
              maxLength={20}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
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

          {/* 이미지 업로드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.imageLabel}
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            {imageUrl ? (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={imageUrl}
                  alt="리뷰 이미지"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute top-1 right-1 w-5 h-5 bg-black bg-opacity-60 rounded-full flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                {uploading ? t.uploading : t.uploadBtn}
              </button>
            )}
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
