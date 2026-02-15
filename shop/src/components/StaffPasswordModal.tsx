"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface StaffPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// 스태프 비밀번호 (나중에 환경변수나 DB로 이동 가능)
const STAFF_PASSWORD = "1004";

export default function StaffPasswordModal({ isOpen, onClose, onSuccess }: StaffPasswordModalProps) {
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password === STAFF_PASSWORD) {
      // 세션 스토리지에 접근 권한 저장 (브라우저 닫으면 초기화)
      sessionStorage.setItem("staff_access", "true");
      setPassword("");
      setError(false);
      onSuccess();
    } else {
      setError(true);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">{t("staff.title")}</h3>
          <p className="text-sm text-gray-500 mt-1">{t("staff.description")}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder={t("staff.placeholder")}
            className={`w-full px-4 py-3 border rounded-lg outline-none transition-colors ${
              error ? "border-red-500" : "border-gray-300 focus:border-gray-900"
            }`}
            autoFocus
          />
          {error && (
            <p className="text-red-500 text-sm mt-2">{t("staff.error")}</p>
          )}

          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              {t("common.confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
