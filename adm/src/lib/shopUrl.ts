// shop 접속 URL 자동 감지 · 사장님 매장 PC에서도 별도 설정 없이 동작
// 우선순위:
// 1) NEXT_PUBLIC_SHOP_URL 환경변수 (Vercel 대시보드 설정 시)
// 2) 브라우저에서 admin URL로부터 유도 (adm 서브도메인/하이픈 제거)
// 3) 개발 로컬 · localhost:3001
//
// 지원 URL 패턴:
// - adm.cookies.shop → cookies.shop
// - cookies-adm.vercel.app → cookies.vercel.app
// - cookiesshop-adm.vercel.app → cookiesshop.vercel.app
// - localhost:3002 → localhost:3001
// 그 외 · 같은 origin 사용 (안전 폴백)

const DEFAULT_LOCAL_SHOP = "http://localhost:3001";

export function getShopUrl(): string {
  // 1) 명시적 env 최우선 (사장님이 Vercel 대시보드에서 NEXT_PUBLIC_SHOP_URL 설정 가능)
  if (process.env.NEXT_PUBLIC_SHOP_URL) return process.env.NEXT_PUBLIC_SHOP_URL;
  // 2) 서버 렌더 시 · 로컬 폴백
  if (typeof window === "undefined") return DEFAULT_LOCAL_SHOP;
  const host = window.location.hostname;
  const origin = window.location.origin;
  // 로컬 개발
  if (host === "localhost" || host === "127.0.0.1") return DEFAULT_LOCAL_SHOP;
  // 서브도메인 형태 · adm.example.com → example.com
  if (host.startsWith("adm.")) return origin.replace("://adm.", "://");
  // 하이픈 접미 · foo-adm.vercel.app → foo.vercel.app
  if (host.includes("-adm.")) return origin.replace("-adm.", ".");
  // 하이픈 접미 (admin) · foo-admin.vercel.app → foo.vercel.app
  if (host.includes("-admin.")) return origin.replace("-admin.", ".");
  // Cookies 패턴 (사장님 프로젝트) · cookiesadm.vercel.app → cookiesshop.vercel.app
  // 일반화 · 첫 라벨이 "adm"으로 끝나면 → "shop"으로 치환
  const firstDot = host.indexOf(".");
  if (firstDot > 0) {
    const firstLabel = host.slice(0, firstDot);
    const rest = host.slice(firstDot);
    if (firstLabel.endsWith("adm") && firstLabel.length > 3) {
      const newFirst = firstLabel.slice(0, -3) + "shop";
      return `${window.location.protocol}//${newFirst}${rest}`;
    }
    if (firstLabel.endsWith("admin") && firstLabel.length > 5) {
      const newFirst = firstLabel.slice(0, -5) + "shop";
      return `${window.location.protocol}//${newFirst}${rest}`;
    }
  }
  // 폴백 · 안전 · 최소한 뭔가는 열리도록 · 같은 origin (관리자 자기 자신)
  // ⚠ 이 경우 · Vercel 대시보드에서 NEXT_PUBLIC_SHOP_URL 설정 권장
  return origin;
}
