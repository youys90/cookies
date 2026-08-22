// 국기 SVG 아이콘 · Windows 이모지 국기 미지원 대응
// - 한국(태극기) · 일본(일장기) 정확한 색상 · 명료한 실루엣
// - inline SVG · 폰트 의존 없음 · 어떤 OS/브라우저에서도 동일 렌더

interface Props {
  code: "KR" | "JP";
  className?: string;
  title?: string;
}

export default function FlagIcon({ code, className = "w-4 h-3", title }: Props) {
  if (code === "KR") {
    return (
      <svg
        viewBox="0 0 60 40"
        className={className}
        role="img"
        aria-label={title || "한국 국기"}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* 흰 바탕 · 미세한 테두리 */}
        <rect width="60" height="40" fill="#FFFFFF" />
        {/* 태극 · 원 · 청색 하단 · 적색 상단 */}
        <g transform="translate(30 20)">
          <circle r="9" fill="#0047A0" />
          <path d="M -9 0 A 9 9 0 0 1 9 0 A 4.5 4.5 0 0 1 0 0 A 4.5 4.5 0 0 0 -9 0 Z" fill="#CD2E3A" />
        </g>
        {/* 4괘 · 좌상 (건 ☰) · 우상 (리 ☲) · 좌하 (감 ☵) · 우하 (곤 ☷) 을 간략화 */}
        <g fill="#000000" fillRule="evenodd">
          {/* 건 · 좌상 (실선 3개) */}
          <rect x="7" y="8" width="10" height="1.5" transform="rotate(-33.7 12 8.75)" />
          <rect x="7" y="11" width="10" height="1.5" transform="rotate(-33.7 12 11.75)" />
          <rect x="7" y="14" width="10" height="1.5" transform="rotate(-33.7 12 14.75)" />
          {/* 리 · 우상 (실-점-실) */}
          <rect x="43" y="8" width="10" height="1.5" transform="rotate(33.7 48 8.75)" />
          <rect x="43" y="11" width="4" height="1.5" transform="rotate(33.7 45 11.75)" />
          <rect x="49" y="11" width="4" height="1.5" transform="rotate(33.7 51 11.75)" />
          <rect x="43" y="14" width="10" height="1.5" transform="rotate(33.7 48 14.75)" />
          {/* 감 · 좌하 (점-실-점) */}
          <rect x="7" y="25" width="4" height="1.5" transform="rotate(33.7 9 25.75)" />
          <rect x="13" y="25" width="4" height="1.5" transform="rotate(33.7 15 25.75)" />
          <rect x="7" y="28" width="10" height="1.5" transform="rotate(33.7 12 28.75)" />
          <rect x="7" y="31" width="4" height="1.5" transform="rotate(33.7 9 31.75)" />
          <rect x="13" y="31" width="4" height="1.5" transform="rotate(33.7 15 31.75)" />
          {/* 곤 · 우하 (점 3개) */}
          <rect x="43" y="25" width="4" height="1.5" transform="rotate(-33.7 45 25.75)" />
          <rect x="49" y="25" width="4" height="1.5" transform="rotate(-33.7 51 25.75)" />
          <rect x="43" y="28" width="4" height="1.5" transform="rotate(-33.7 45 28.75)" />
          <rect x="49" y="28" width="4" height="1.5" transform="rotate(-33.7 51 28.75)" />
          <rect x="43" y="31" width="4" height="1.5" transform="rotate(-33.7 45 31.75)" />
          <rect x="49" y="31" width="4" height="1.5" transform="rotate(-33.7 51 31.75)" />
        </g>
      </svg>
    );
  }
  // JP
  return (
    <svg
      viewBox="0 0 60 40"
      className={className}
      role="img"
      aria-label={title || "일본 국기"}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="60" height="40" fill="#FFFFFF" />
      <circle cx="30" cy="20" r="12" fill="#BC002D" />
    </svg>
  );
}
