// Anthropic Claude API 유틸
// - ANTHROPIC_API_KEY 없으면 자동으로 mock 응답
// - SDK는 조건부 dynamic import (미설치 상태여도 빌드 깨지지 않음)
// - 결제·키 확보 후엔 자동 실제 호출 전환

const MODEL = "claude-sonnet-4-6-20250929"; // 저비용·빠름·비전 지원

export function hasApiKey(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
}

type MsgContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

interface ClaudeCallInput {
  system?: string;
  user: MsgContent[];
  maxTokens?: number;
}

interface ClaudeCallResult {
  ok: true;
  mock: boolean;
  text: string;
}

interface ClaudeCallError {
  ok: false;
  mock: boolean;
  error: string;
}

export type ClaudeResponse = ClaudeCallResult | ClaudeCallError;

export async function callClaude(input: ClaudeCallInput): Promise<ClaudeResponse> {
  if (!hasApiKey()) {
    return {
      ok: false,
      mock: true,
      error:
        "ANTHROPIC_API_KEY 미설정 (개발 mock 모드). cookies/adm/.env.local에 키 추가 후 서버 재시작하세요.",
    };
  }

  try {
    // 동적 import — 설치 안 된 상태에서도 빌드 안 깨짐
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: input.maxTokens ?? 1024,
      system: input.system,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: "user", content: input.user as any }],
    });

    // 텍스트만 추출
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts = (resp.content as any[]).filter((c) => c.type === "text");
    const text = parts.map((p) => p.text).join("\n").trim();
    return { ok: true, mock: false, text };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, mock: false, error: msg };
  }
}

// JSON 문자열 안전 파싱 (Claude가 코드블록으로 감쌀 수 있음)
export function extractJson<T = unknown>(raw: string): T | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // 첫 { .. 마지막 } 로 재시도
    const s = stripped.indexOf("{");
    const e = stripped.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try {
        return JSON.parse(stripped.slice(s, e + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
