// POST /api/report — 화면에 나온 답변을 정부 보고서 문체의 줄글로 정리해 돌려준다 (PDF 저장용)
// OPENAI_API_KEY는 서버 코드(lib/ask-report.ts)에서만 읽는다.

import { clientIp, createRateLimiter, isSameOrigin } from "@/lib/guard";
import { ReportError, askReport, reportRequestSchema } from "@/lib/ask-report";

// 화면에 보여 줄 고정 안내 문구. AI나 시스템의 오류 문장은 내보내지 않는다.
const ERRORS = {
  INVALID_REQUEST: { status: 400, message: "보고서로 만들 답변이 올바르지 않아요" },
  FORBIDDEN: { status: 403, message: "허용되지 않은 요청이에요" },
  RATE_LIMITED: { status: 429, message: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요" },
  AI_FAILED: { status: 502, message: "보고서를 만들지 못했어요. 잠시 후 다시 시도해 주세요" },
  TIMEOUT: { status: 504, message: "보고서 만드는 시간이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요" },
} as const;

function errorResponse(code: keyof typeof ERRORS) {
  const { status, message } = ERRORS[code];
  return Response.json({ error: { code, message } }, { status });
}

// 보고서는 AI를 크게 쓰므로 1분에 3번까지만 허용한다
const isRateLimited = createRateLimiter(3);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("FORBIDDEN");
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse("INVALID_REQUEST");
  }
  if (isRateLimited(clientIp(request))) return errorResponse("RATE_LIMITED");

  let body;
  try {
    body = reportRequestSchema.parse(await request.json());
  } catch {
    return errorResponse("INVALID_REQUEST");
  }

  try {
    return Response.json(await askReport(body));
  } catch (error) {
    if (error instanceof ReportError) return errorResponse(error.code);
    console.error("[report] 처리 중 오류:", error instanceof Error ? error.name : "unknown");
    return errorResponse("AI_FAILED");
  }
}
