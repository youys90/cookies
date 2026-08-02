// 한/일 무료 번역 유틸
// 1차: MyMemory API (하루 10,000자 무료)
// 2차: Google Translate 무료 fallback
// 상품 등록 페이지에서 검증된 방식 재사용

const PLACEHOLDER = "{{EN}}";

// 영문 단어는 번역기가 이상하게 바꾸는 걸 방지 (예: CHANEL → 채넬)
function protectEnglish(text: string): { preserved: string; parts: string[] } {
  const parts: string[] = [];
  const preserved = text.replace(/[A-Za-z]+/g, (match) => {
    parts.push(match);
    return PLACEHOLDER;
  });
  return { preserved, parts };
}

function restoreEnglish(translated: string, parts: string[]): string {
  let result = translated;
  parts.forEach((eng) => {
    result = result.replace(PLACEHOLDER, eng);
  });
  return result;
}

export async function translateKoJa(
  text: string,
  from: "ko" | "ja",
  to: "ko" | "ja",
): Promise<string> {
  if (!text.trim()) return "";
  if (from === to) return text;

  const { preserved, parts } = protectEnglish(text);

  // 1차: MyMemory API
  // email(de) 파라미터를 붙이면 익명(5,000자/일) → 등록(10,000자/일) quota로 확장됨
  // IP 기반 익명 quota 소진 방지 목적. 환경변수 MYMEMORY_EMAIL로 관리.
  try {
    const email = process.env.MYMEMORY_EMAIL || process.env.NEXT_PUBLIC_MYMEMORY_EMAIL || "";
    const emailParam = email ? `&de=${encodeURIComponent(email)}` : "";
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(preserved)}&langpair=${from}|${to}${emailParam}`,
    );
    const data = await res.json();
    const translated = data.responseData?.translatedText || "";
    if (translated && !translated.includes("MYMEMORY WARNING")) {
      return restoreEnglish(translated, parts);
    }
  } catch (err) {
    console.error("MyMemory 번역 실패:", err);
  }

  // 2차: Google Translate 무료 fallback
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(preserved)}`,
    );
    const data = await res.json();
    const translated = data[0]?.map((item: string[]) => item[0]).join("") || text;
    return restoreEnglish(translated, parts);
  } catch (err) {
    console.error("Google 번역 실패:", err);
    return text;
  }
}
