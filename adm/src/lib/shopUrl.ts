// shop 접속 URL · 사장님 매장 PC · 별도 설정 없이 동작
// 방탄 우선순위:
// 1) 명시적 하드코딩 매핑 (사장님 배포 URL · 절대 실패 없음)
// 2) hostname 패턴 감지 (adm → shop 자동 치환)
// 3) NEXT_PUBLIC_SHOP_URL env (self-loop 방지 조건부)
// 4) 로컬 폴백

const DEFAULT_LOCAL_SHOP = "http://localhost:3001";

// 사장님 실제 배포 URL · 명시 매핑 (절대 오설정 방지)
const EXPLICIT_MAP: Record<string, string> = {
  "cookiesadm.vercel.app": "https://cookiesshop.vercel.app",
  "cookies-adm.vercel.app": "https://cookies-shop.vercel.app",
};

function detectFromHost(host: string, origin: string, protocol: string): string {
  // 로컬 개발
  if (host === "localhost" || host === "127.0.0.1") return DEFAULT_LOCAL_SHOP;
  // 명시 매핑 최우선
  if (EXPLICIT_MAP[host]) return EXPLICIT_MAP[host];
  // Vercel preview URL · cookies-git-*.vercel.app · cookies-vys*.vercel.app 등 → 실 shop으로
  if (/^cookies-git-.+\.vercel\.app$/.test(host)) return "https://cookiesshop.vercel.app";
  if (/^cookies-[a-z0-9]+-.+\.vercel\.app$/.test(host)) return "https://cookiesshop.vercel.app";
  // 서브도메인 형태 · adm.example.com → example.com
  if (host.startsWith("adm.")) return origin.replace("://adm.", "://");
  // 하이픈 접미 · foo-adm.vercel.app → foo.vercel.app
  if (host.includes("-adm.")) return origin.replace("-adm.", ".");
  if (host.includes("-admin.")) return origin.replace("-admin.", ".");
  // 일반화 · 첫 라벨이 "adm"/"admin"으로 끝나면 → "shop"으로 치환
  const firstDot = host.indexOf(".");
  if (firstDot > 0) {
    const firstLabel = host.slice(0, firstDot);
    const rest = host.slice(firstDot);
    if (firstLabel.endsWith("admin") && firstLabel.length > 5) {
      return `${protocol}//${firstLabel.slice(0, -5)}shop${rest}`;
    }
    if (firstLabel.endsWith("adm") && firstLabel.length > 3) {
      return `${protocol}//${firstLabel.slice(0, -3)}shop${rest}`;
    }
  }
  // 폴백 · 같은 origin (자기 자신 로드 방지 못 하지만 · env 아니면 어차피 여기 도달 힘듬)
  return origin;
}

export function getShopUrl(): string {
  // 서버 렌더 시 · env 또는 로컬
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_SHOP_URL || DEFAULT_LOCAL_SHOP;
  }
  const host = window.location.hostname;
  const origin = window.location.origin;
  const protocol = window.location.protocol;
  const detected = detectFromHost(host, origin, protocol);
  // env가 설정돼있으면 · 자기 자신을 가리키지 않는 한 · env 우선
  const envUrl = process.env.NEXT_PUBLIC_SHOP_URL;
  if (envUrl) {
    const cleanEnv = envUrl.replace(/\/$/, "");
    if (cleanEnv === origin) {
      // env가 관리자 자기 자신 → 오설정 · 무시하고 감지값 반환
      return detected;
    }
    return envUrl;
  }
  return detected;
}
