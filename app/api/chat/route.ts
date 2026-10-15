// Design Ref: §5 API — POST /api/chat
// 질문을 받아 관련 문서 조각을 찾고, AI에게 물어 정해진 형식의 답을 돌려준다.
// OPENAI_API_KEY는 이 서버 코드에서만 읽는다. 브라우저로는 나가지 않는다.

import { z } from "zod";
import { AskAiError, TIMEOUT_MS, askAi } from "@/lib/ask-ai";
import { loadDocuments } from "@/lib/documents";
import { getSuggestions, findChunks } from "@/lib/search";
import { checkAnswer, emptyCountry } from "@/lib/sources";

// 질문은 문자열이고, 앞뒤 공백을 뺀 길이가 1~300자여야 한다 (DESIGN §5, §8)
const requestSchema = z.object({
  question: z.string().trim().min(1).max(300),
});

// 화면에 보여 줄 고정 안내 문구 (DESIGN §7). AI나 시스템의 오류 문장은 내보내지 않는다.
const ERRORS = {
  INVALID_QUESTION: { status: 400, message: "질문을 1자 이상 300자 이내로 입력해 주세요" },
  FORBIDDEN: { status: 403, message: "허용되지 않은 요청이에요" },
  RATE_LIMITED: { status: 429, message: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요" },
  AI_FAILED: { status: 502, message: "답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요" },
  TIMEOUT: { status: 504, message: "답변이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요" },
} as const;

function errorResponse(code: keyof typeof ERRORS) {
  const { status, message } = ERRORS[code];
  return Response.json({ error: { code, message } }, { status });
}

// 호출 횟수 제한: 같은 주소(IP)에서 1분에 10번까지 (비용 폭주 방지, CHECK 3번).
// 서버 한 대의 기억 안에서만 세므로 완전하지 않다. 배포 때 Vercel 방화벽 제한도 함께 켠다.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    // 기억이 너무 커지지 않게 오래된 주소를 지운다
    for (const [key, times] of hits) {
      if (times.every((time) => now - time >= RATE_WINDOW_MS)) hits.delete(key);
    }
  }
  return recent.length > RATE_LIMIT;
}

// 다른 사이트의 페이지가 방문자 브라우저로 이 API를 부르는 것을 막는다
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // 브라우저가 아닌 직접 호출(curl 등)은 Origin이 없다
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now(); // 서버 전체 10초 안에 끝내기 위해 시작 시각을 적어 둔다
  if (!isSameOrigin(request)) return errorResponse("FORBIDDEN");
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse("INVALID_QUESTION");
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (isRateLimited(ip)) return errorResponse("RATE_LIMITED");

  // 1) 질문 검사: 깨진 JSON이나 형식이 다른 요청은 400
  let question: string;
  try {
    question = requestSchema.parse(await request.json()).question;
  } catch {
    return errorResponse("INVALID_QUESTION");
  }

  try {
    // 2) 관련 문서 조각 찾기
    const chunks = await findChunks(question);
    const suggestions = await getSuggestions();

    // 3) 조각이 하나도 없으면 AI를 부르지 않고 바로 "근거 없음"으로 답한다 (DESIGN §3)
    if (chunks.length === 0) {
      return Response.json({
        status: "no_source",
        countries: { KR: emptyCountry(), JP: emptyCountry(), CN: emptyCountry() },
        sources: [],
        suggestions,
      });
    }

    // 4) AI에게 묻고, 답을 검사해 출처 정보를 우리 문서 정보로 채운다
    // 검색에 쓴 시간을 뺀 남은 시간만 AI에게 준다 (DESIGN §5: 서버 전체 10초)
    const remaining = TIMEOUT_MS - (Date.now() - startedAt);
    if (remaining < 1500) return errorResponse("TIMEOUT");
    const answer = await askAi(question, chunks, remaining);
    const { docs } = await loadDocuments();
    const checked = checkAnswer(answer, chunks, docs);

    return Response.json({
      ...checked,
      suggestions: checked.status === "ok" ? [] : suggestions,
    });
  } catch (error) {
    if (error instanceof AskAiError) return errorResponse(error.code);
    console.error("[chat] 처리 중 오류:", error instanceof Error ? error.name : "unknown");
    return errorResponse("AI_FAILED");
  }
}
