// 카테고리 관리 기본 아이콘 세트
// icon_url 컬럼에 "builtin:{key}" 형식으로 저장 → shop 렌더 시 해당 SVG 표시
// 이미지 URL(http/https)이면 이미지 그대로 표시

import React from "react";

export const BUILTIN_ICON_PREFIX = "builtin:";

type IconKey =
  | "ring" | "bag" | "necklace" | "ribbon" | "cup" | "lamp" | "note" | "heart"
  | "key" | "glass" | "glove" | "watch" | "shoe" | "hat" | "eye" | "star"
  | "sparkle" | "box" | "shirt" | "diamond" | "flower" | "crown" | "bell"
  | "gift" | "leaf";

export const BUILTIN_ICON_KEYS: IconKey[] = [
  "ring", "bag", "necklace", "ribbon", "cup", "lamp", "note", "heart",
  "key", "glass", "glove", "watch", "shoe", "hat", "eye", "star",
  "sparkle", "box", "shirt", "diamond", "flower", "crown", "bell", "gift", "leaf",
];

interface IconProps {
  className?: string;
  size?: number;
}

// 기존 shop CategoryIcon과 동일한 스타일 (viewBox 48, strokeWidth 1.3)
export function BuiltinCategoryIcon({ name, className, size = 28 }: { name: string; className?: string; size?: number }): React.ReactElement | null {
  const c = className || "";
  const common = { className: c, width: size, height: size, viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: "1.3" };

  switch (name) {
    case "ring":     return (<svg {...common}><circle cx="24" cy="30" r="9" /><path d="M16 22l4-7h8l4 7" /><path d="M22 14l2 2 2-2" /></svg>);
    case "bag":      return (<svg {...common}><path d="M13 17h22l-2 21H15L13 17z" /><path d="M19 17v-2a5 5 0 0110 0v2" /></svg>);
    case "necklace": return (<svg {...common}><path d="M11 13c4 12 13 19 13 19s9-7 13-19" /><path d="M24 32l-2.5 4h5l-2.5-4z" /></svg>);
    case "ribbon":   return (<svg {...common}><path d="M18 18c-4-4-10-2-10 4s6 8 10 4c-4 4-2 10 4 10s8-6 4-10c4 4 10 2 10-4s-6-8-10-4c4-4 2-10-4-10s-8 6-4 10z" /><circle cx="24" cy="24" r="2" /></svg>);
    case "cup":      return (<svg {...common}><path d="M14 18h18v14a5 5 0 01-5 5h-8a5 5 0 01-5-5V18z" /><path d="M32 22h3a4 4 0 010 8h-3" /></svg>);
    case "lamp":     return (<svg {...common}><path d="M17 18l3-7h8l3 7" /><path d="M17 18l2 9h10l2-9" /><path d="M24 27v9M18 36h12" /></svg>);
    case "note":     return (<svg {...common}><rect x="13" y="11" width="22" height="26" rx="1.5" /><path d="M17 17h14M17 22h14M17 27h10" /></svg>);
    case "heart":    return (<svg {...common}><path d="M24 36s-11-6-11-15a6 6 0 0111-3 6 6 0 0111 3c0 9-11 15-11 15z" /></svg>);
    case "key":      return (<svg {...common}><circle cx="14" cy="24" r="6" /><path d="M20 24h20l-4 4M32 24v4" /></svg>);
    case "glass":    return (<svg {...common}><circle cx="15" cy="26" r="6" /><circle cx="33" cy="26" r="6" /><path d="M21 24h6" /></svg>);
    case "glove":    return (<svg {...common}><path d="M16 12h4v20l4 4h6l4-4v-6a4 4 0 00-4-4h-4V16a2 2 0 00-4 0v-4z" /></svg>);
    case "watch":    return (<svg {...common}><circle cx="24" cy="24" r="8" /><path d="M20 14v-4h8v4M20 34v4h8v-4M24 20v4l3 2" /></svg>);
    case "shoe":     return (<svg {...common}><path d="M8 26h20l6-6 6 4v6H8v-4z" /><path d="M12 30v2M18 30v2M24 30v2M30 30v2M36 30v2" /></svg>);
    case "hat":      return (<svg {...common}><path d="M10 32c0-8 6-16 14-16s14 8 14 16z" /><path d="M8 32h32" /></svg>);
    case "eye":      return (<svg {...common}><path d="M6 24s7-10 18-10 18 10 18 10-7 10-18 10S6 24 6 24z" /><circle cx="24" cy="24" r="4" /></svg>);
    case "star":     return (<svg {...common}><path d="M24 10l4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z" /></svg>);
    case "sparkle":  return (<svg {...common}><path d="M24 8v14M24 26v14M8 24h14M26 24h14" /><path d="M14 14l6 6M28 28l6 6M14 34l6-6M28 20l6-6" /></svg>);
    case "box":      return (<svg {...common}><rect x="10" y="14" width="28" height="24" /><path d="M10 22h28M24 14v24" /></svg>);
    case "shirt":    return (<svg {...common}><path d="M14 14l-4 6 6 4v14h16V24l6-4-4-6-6 2h-8z" /><path d="M20 14l4 4 4-4" /></svg>);
    case "diamond":  return (<svg {...common}><path d="M12 18l6-8h12l6 8-12 20z" /><path d="M12 18h24M18 10l6 8 6-8" /></svg>);
    case "flower":   return (<svg {...common}><circle cx="24" cy="24" r="4" /><circle cx="24" cy="14" r="5" /><circle cx="24" cy="34" r="5" /><circle cx="14" cy="24" r="5" /><circle cx="34" cy="24" r="5" /></svg>);
    case "crown":    return (<svg {...common}><path d="M10 30l4-14 6 8 4-12 4 12 6-8 4 14z" /><path d="M10 34h28" /></svg>);
    case "bell":     return (<svg {...common}><path d="M14 30V22a10 10 0 0120 0v8l3 4H11z" /><path d="M21 38a3 3 0 006 0" /></svg>);
    case "gift":     return (<svg {...common}><rect x="10" y="18" width="28" height="20" /><path d="M8 12h32v6H8z" /><path d="M24 12v26M18 12c-4 0-4-6 0-6s6 6 6 6M30 12c4 0 4-6 0-6s-6 6-6 6" /></svg>);
    case "leaf":     return (<svg {...common}><path d="M10 34c0-14 10-24 24-24 0 14-10 24-24 24z" /><path d="M10 34l18-18" /></svg>);
    default: return null;
  }
}
