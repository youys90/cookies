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

// hostname 기반 감지 · env와 무관
function detectFromHost(): string {
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
    if (firstLabel.endsWith("admin") && firstLabel.length > 5) {
      const newFirst = firstLabel.slice(0, -5) + "shop";
      return `${window.location.protocol}//${newFirst}${rest}`;
    }
    if (firstLabel.endsWith("adm") && firstLabel.length > 3) {
      const newFirst = firstLabel.slice(0, -3) + "shop";
      return `${window.location.protocol}//${newFirst}${rest}`;
    }
  }
  // 폴백 · 안전 · 최소한 뭔가는 열리도록 · 같은 origin (관리자 자기 자신)
  return origin;
}

export function getShopUrl(): string {
  const detected = detectFromHost();
  // env가 설정돼있으면 우선 · 단 · 자기 자신(관리자 origin)을 가리키면 무시하고 hostname 감지값 사용
  const envUrl = process.env.NEXT_PUBLIC_SHOP_URL;
  if (envUrl) {
    if (typeof window !== "undefined") {
      const currentOrigin = window.location.origin;
      const cleanEnv = envUrl.replace(/\/$/, "");
      // env가 관리자 자기 자신을 가리키는 경우 · 오설정 · hostname 감지값으로 폴백
      if (cleanEnv === currentOrigin || cleanEnv === currentOrigin.replace(/^https?:\/\//, "")) {
        return detected;
      }
    }
    return envUrl;
  }
  return detected;
}
