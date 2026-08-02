"use client";

// 프리미엄 접근 모달
// - 비밀번호는 서버 API(/api/staff/verify)에서만 검증
// - 성공 시 서버가 HMAC 서명된 httpOnly 쿠키 발급 (클라 조작 불가)
// - rate limit 제거됨 (사장님 지시)

import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface StaffPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categoryId: number | null;
  categoryLabel?: string;
}

export default function StaffPasswordModal({ isOpen, onClose, onSuccess, categoryId, categoryLabel }: StaffPasswordModalProps) {
  const { t, language } = useLanguage();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPassword("");
        setError(null);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!categoryId) {
        setError(t("staff.error"));
        setSubmitting(false);
        return;
      }
      const res = await fetch("/api/staff/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, password }),
      });

      if (!res.ok) {
        setError(t("staff.error"));
      } else {
        setPassword("");
        onSuccess();
      }
    } catch {
      setError(
        language === "ja"
          ? "ネットワークエラーが発生しました。"
          : "네트워크 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-modal-title"
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 id="staff-modal-title" className="text-lg font-medium text-gray-900">
            {categoryLabel ? `🔒 ${categoryLabel}` : t("staff.title")}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{t("staff.description")}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder={t("staff.placeholder")}
            className={`w-full px-4 py-3 border rounded-lg outline-none transition-colors ${
              error ? "border-red-500" : "border-gray-300 focus:border-gray-900"
            }`}
            autoFocus
            disabled={submitting}
          />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting || !password}
              className="flex-1 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {submitting ? t("common.loading") : t("common.confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
