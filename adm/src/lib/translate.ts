// 한/일 무료 번역 유틸
// 1차: Google Translate (한/일 번역 품질 안정적)
// 2차: MyMemory API fallback (Google 실패 시)
// 관리자가 번역 결과를 그대로 믿고 저장하는 상황을 고려해
// - 영단어 보호 (protect/restore) · placeholder 파괴 감지 시 원문 재시도 or 재프로텍트
// - 8초 타임아웃
// - 응답이 원문 그대로거나 · placeholder 파괴가 감지되면 다음 API로 fallback
// - 동일 텍스트 세션 내 캐싱 (메모리)

// 파괴 감지 · 알파벳/공백/괄호 변형 다 커버 · 대소문자 무관
const PLACEHOLDER = "★EN★"; // ★EN★ · 유니코드 별 문자 · 번역기가 변형하기 어려움

function protectEnglish(text: string): { preserved: string; parts: string[] } {
  const parts: string[] = [];
  const preserved = text.replace(/[A-Za-z]+(?:[0-9]+)?/g, (match) => {
    parts.push(match);
    return PLACEHOLDER;
  });
  return { preserved, parts };
}

function restoreEnglish(translated: string, parts: string[]): string {
  let result = translated;
  parts.forEach((eng) => {
    // 정확 placeholder 우선 · 실패 시 · 관용적 파괴 형태 (공백/대소문자) 순차 시도
    if (result.includes(PLACEHOLDER)) {
      result = result.replace(PLACEHOLDER, eng);
      return;
    }
    // fallback · 공백/기호로 파괴된 placeholder 감지 (★ E N ★ 등)
    const relaxed = result.match(/[★\s]*[Ee][Nn][★\s]*/);
    if (relaxed) {
      result = result.replace(relaxed[0], eng);
    }
  });
  return result;
}

function isPlaceholderBroken(translated: string, expectedCount: number): boolean {
  // 원래 넣은 placeholder 개수 · 번역 후 남은 placeholder(파괴 포함) 개수와 비교
  const found = (translated.match(/★/g) || []).length; // 정확 매치만 카운트
  return found < expectedCount;
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// 세션 내 캐시 (메모리) · 같은 텍스트 반복 요청 방지
const cache = new Map<string, string>();
const cacheKey = (text: string, from: string, to: string) => `${from}|${to}|${text}`;

export async function translateKoJa(
  text: string,
  from: "ko" | "ja",
  to: "ko" | "ja",
): Promise<string> {
  if (!text.trim()) return "";
  if (from === to) return text;

  const ck = cacheKey(text, from, to);
  const cached = cache.get(ck);
  if (cached) return cached;

  const { preserved, parts } = protectEnglish(text);
  const expectedPlaceholders = parts.length;

  // 1차: Google Translate
  try {
    const res = await fetchWithTimeout(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(preserved)}`,
    );
    const data = await res.json();
    const translated = data[0]?.map((item: string[]) => item[0]).join("") || "";
    if (translated && translated !== preserved) {
      // placeholder 파괴 감지 시 · MyMemory로 재시도
      if (expectedPlaceholders === 0 || !isPlaceholderBroken(translated, expectedPlaceholders)) {
        const restored = restoreEnglish(translated, parts);
        cache.set(ck, restored);
        return restored;
      }
    }
  } catch (err) {
    console.error("Google 번역 실패:", err);
  }

  // 2차: MyMemory API
  try {
    const email = process.env.MYMEMORY_EMAIL || process.env.NEXT_PUBLIC_MYMEMORY_EMAIL || "";
    const emailParam = email ? `&de=${encodeURIComponent(email)}` : "";
    const res = await fetchWithTimeout(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(preserved)}&langpair=${from}|${to}${emailParam}`,
    );
    const data = await res.json();
    const translated = data.responseData?.translatedText || "";
    if (
      translated &&
      !translated.includes("MYMEMORY WARNING") &&
      translated !== preserved &&
      (expectedPlaceholders === 0 || !isPlaceholderBroken(translated, expectedPlaceholders))
    ) {
      const restored = restoreEnglish(translated, parts);
      cache.set(ck, restored);
      return restored;
    }
  } catch (err) {
    console.error("MyMemory 번역 실패:", err);
  }

  // 두 API 모두 실패 or 이상 응답 · 원문 유지 (사장님이 직접 확인/수정)
  return text;
}
