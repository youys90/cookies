"use client";

import { useLanguage } from "@/contexts/LanguageContext";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex justify-center py-3 bg-white border-b border-gray-100">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setLanguage("ja")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
            language === "ja"
              ? "bg-gray-900 text-white shadow-sm"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
          aria-label="日本語"
        >
          {/* 일본 국기 */}
          <svg className="w-5 h-5" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
            <rect fill="#FFFFFF" width="36" height="36" rx="2"/>
            <circle fill="#BC002D" cx="18" cy="18" r="7"/>
          </svg>
          <span className="text-xs font-medium">JP</span>
        </button>

        <button
          onClick={() => setLanguage("ko")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
            language === "ko"
              ? "bg-gray-900 text-white shadow-sm"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
          aria-label="한국어"
        >
          {/* 한국 국기 (태극기 간소화) */}
          <svg className="w-5 h-5" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
            <rect fill="#FFFFFF" width="36" height="36" rx="2"/>
            {/* 태극 원 */}
            <circle fill="#C60C30" cx="18" cy="18" r="6"/>
            <path fill="#003478" d="M18 12c3.314 0 6 2.686 6 6s-2.686 6-6 6c0-3.314 0-6 0-6s0-2.686 0-6z"/>
            <circle fill="#C60C30" cx="18" cy="15" r="3"/>
            <circle fill="#003478" cx="18" cy="21" r="3"/>
            {/* 건곤감리 간소화 */}
            <rect fill="#000" x="6" y="8" width="6" height="1.5" rx="0.5"/>
            <rect fill="#000" x="6" y="11" width="6" height="1.5" rx="0.5"/>
            <rect fill="#000" x="24" y="8" width="6" height="1.5" rx="0.5"/>
            <rect fill="#000" x="24" y="11" width="6" height="1.5" rx="0.5"/>
            <rect fill="#000" x="6" y="23.5" width="6" height="1.5" rx="0.5"/>
            <rect fill="#000" x="6" y="26.5" width="6" height="1.5" rx="0.5"/>
            <rect fill="#000" x="24" y="23.5" width="6" height="1.5" rx="0.5"/>
            <rect fill="#000" x="24" y="26.5" width="6" height="1.5" rx="0.5"/>
          </svg>
          <span className="text-xs font-medium">KR</span>
        </button>
      </div>
    </div>
  );
}
