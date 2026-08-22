"use client";

// 관리자 포털 전체 표준 · 하단 sticky 액션 바
// - 좌: 취소 (부드러운 빨강 · 저장보다 덜 눈에 띔)
// - 우: 주 액션 (등록/저장) 브랜드 컬러 · 가장 눈에 띔
// - 우측에 보조 액션 (임시저장 등) 추가 가능
//
// 사용 예:
// <FormActionBar
//   onCancel={() => router.push('/products')}
//   primary={{ label: '상품 등록', onClick: handleSubmit, disabled: uploading }}
//   secondary={{ label: '💾 임시저장', onClick: manualSave }}
//   status="방금 저장됨"
// />

import { ReactNode } from "react";
import { useRouter } from "next/navigation";

interface ActionButton {
  label: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
}

interface Props {
  /** 취소 · href 지정 시 링크 · 아니면 뒤로가기 */
  cancelHref?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  /** 주 액션 (등록/저장) · 브랜드 컬러 · 가장 큰 버튼 */
  primary: ActionButton;
  /** 보조 액션 (임시저장 등) · 있으면 primary 왼쪽에 노출 */
  secondary?: ActionButton | ActionButton[];
  /** 좌측 상태 표시 (「방금 저장됨」 · 진행률 등) */
  status?: ReactNode;
  /** 액션바 배경 · 기본은 흰색 반투명 */
  variant?: "default" | "dark";
}

export default function FormActionBar({
  cancelHref,
  cancelLabel = "취소",
  onCancel,
  primary,
  secondary,
  status,
  variant = "default",
}: Props) {
  const router = useRouter();
  const handleCancel = () => {
    if (onCancel) return onCancel();
    if (cancelHref) return router.push(cancelHref);
    router.back();
  };

  const secondaryArr = secondary ? (Array.isArray(secondary) ? secondary : [secondary]) : [];

  const isDark = variant === "dark";

  return (
    <div className={`sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 mt-6 px-4 sm:px-6 lg:px-8 py-3 backdrop-blur border-t ${
      isDark ? "bg-gray-900/95 border-gray-800 text-white" : "bg-white/95 border-gray-200"
    } z-20`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleCancel}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition flex items-center gap-1.5 ${
            isDark
              ? "text-red-300 border border-red-900/60 bg-red-950/40 hover:bg-red-900/40"
              : "text-red-600 border border-red-200 bg-white hover:bg-red-50"
          }`}
        >
          ← {cancelLabel}
        </button>

        {status && (
          <div className={`text-xs flex-1 text-center ${isDark ? "text-gray-300" : "text-gray-500"}`}>
            {status}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {secondaryArr.map((btn, i) => (
            <SecondaryButton key={i} btn={btn} isDark={isDark} />
          ))}
          <PrimaryButton btn={primary} isDark={isDark} />
        </div>
      </div>
    </div>
  );
}

function PrimaryButton({ btn, isDark }: { btn: ActionButton; isDark: boolean }) {
  const cls = `px-5 py-2 text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${
    isDark ? "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dk)]" : "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dk)]"
  }`;
  if (btn.href) return <a href={btn.href} className={cls}>{btn.label}</a>;
  return (
    <button
      type="button"
      onClick={btn.onClick}
      disabled={btn.disabled || btn.loading}
      className={cls}
    >
      {btn.loading ? "처리 중..." : btn.label}
    </button>
  );
}

function SecondaryButton({ btn, isDark }: { btn: ActionButton; isDark: boolean }) {
  const cls = `px-3.5 py-2 text-sm rounded-lg transition disabled:opacity-40 ${
    isDark
      ? "bg-white/10 text-white border border-white/20 hover:bg-white/20"
      : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
  }`;
  if (btn.href) return <a href={btn.href} className={cls}>{btn.label}</a>;
  return (
    <button
      type="button"
      onClick={btn.onClick}
      disabled={btn.disabled || btn.loading}
      className={cls}
    >
      {btn.loading ? "처리 중..." : btn.label}
    </button>
  );
}
