// Design Ref: §5 API — POST /api/chat
// 질문을 받아 관련 문서 조각을 찾고, AI에게 물어 정해진 형식의 답을 돌려준다.
// OPENAI_API_KEY는 이 서버 코드에서만 읽는다. 브라우저로는 나가지 않는다.

import { z } from "zod";
import { AskAiError, askAi } from "@/lib/ask-ai";
import { findChunks } from "@/lib/search";

// 질문은 문자열이고, 앞뒤 공백을 뺀 길이가 1~300자여야 한다 (DESIGN §5, §8)
const requestSchema = z.object({
  question: z.string().trim().min(1).max(300),
});

// 화면에 보여 줄 고정 안내 문구 (DESIGN §7). AI나 시스템의 오류 문장은 내보내지 않는다.
const ERRORS = {
  INVALID_QUESTION: { status: 400, message: "질문을 1자 이상 300자 이내로 입력해 주세요" },
  AI_FAILED: { status: 502, message: "답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요" },
  TIMEOUT: { status: 504, message: "답변이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요" },
} as const;

function errorResponse(code: keyof typeof ERRORS) {
  const { status, message } = ERRORS[code];
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  // 1) 질문 검사: 깨진 JSON이나 형식이 다른 요청은 400
  let question: string;
  try {
    question = requestSchema.parse(await request.json()).question;
  } catch {
    return errorResponse("INVALID_QUESTION");
  }

  // 2) 관련 문서 조각 찾기
  const chunks = await findChunks(question);

  // 3) 조각이 하나도 없으면 AI를 부르지 않고 바로 "근거 없음"으로 답한다 (DESIGN §3)
  const emptyCountry = { overview: null, regulation: null, recent: null };
  if (chunks.length === 0) {
    return Response.json({
      status: "no_source",
      countries: { KR: emptyCountry, JP: emptyCountry, CN: emptyCountry },
      sources: [], // 출처 정보 채우기는 작업 9에서 만든다
      suggestions: [], // 키워드 예시는 작업 7·10에서 채운다
    });
  }

  // 4) AI에게 묻기
  try {
    const answer = await askAi(question, chunks);
    return Response.json({
      status: answer.status,
      countries: answer.countries,
      sources: [], // 출처 정보 채우기는 작업 9에서 만든다
      suggestions: [],
    });
  } catch (error) {
    return errorResponse(error instanceof AskAiError ? error.code : "AI_FAILED");
  }
}
