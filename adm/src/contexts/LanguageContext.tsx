"use client";

// adm 언어 컨텍스트 · 관리자(한국인) 편의 · 기본 한국어
// 필요 시 헤더 스위처로 일본어 전환 (일본인 고객 응대 · 상품 원문 확인)
// localStorage에 선호 저장

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type AdmLanguage = "ko" | "ja";

interface AdmLanguageContextType {
  language: AdmLanguage;
  setLanguage: (l: AdmLanguage) => void;
  // 상품·카테고리 다국어 필드 도우미 (한국어 없으면 일본어로 fallback)
  pickName: (o: { name_ko?: string | null; name_ja?: string | null; name?: string | null }) => string;
  pickCategory: (o: { category_ko?: string | null; category_ja?: string | null; category?: string | null }) => string;
}

const Ctx = createContext<AdmLanguageContextType | undefined>(undefined);

const STORAGE_KEY = "adm.language";

export function AdmLanguageProvider({ children }: { children: ReactNode }) {
  // SSR/CSR mismatch 방지: 첫 렌더는 무조건 ko
  const [language, setLanguageState] = useState<AdmLanguage>("ko");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "ja" || saved === "ko") setLanguageState(saved);
    } catch {}
  }, []);

  const setLanguage = (l: AdmLanguage) => {
    setLanguageState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  };

  const pickName = (o: { name_ko?: string | null; name_ja?: string | null; name?: string | null }): string => {
    if (language === "ko") return o.name_ko || o.name_ja || o.name || "";
    return o.name_ja || o.name || o.name_ko || "";
  };

  const pickCategory = (o: { category_ko?: string | null; category_ja?: string | null; category?: string | null }): string => {
    if (language === "ko") return o.category_ko || o.category_ja || o.category || "";
    return o.category_ja || o.category || o.category_ko || "";
  };

  return (
    <Ctx.Provider value={{ language, setLanguage, pickName, pickCategory }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdmLanguage() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmLanguage must be used within AdmLanguageProvider");
  return v;
}
