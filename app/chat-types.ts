// 챗봇 화면(chat-panel)과 보고서 화면(report-view)이 함께 쓰는 자료 모양과 표 구성

export type Cell = { text: string; sourceNumbers: number[] } | null;
export type CountryAnswer = { overview: Cell; regulation: Cell; recent: Cell };
export type Source = {
  number: number;
  docTitle: string;
  institution: string;
  asOf: string;
  heading: string;
  sourceUrl: string;
};
export type ApiAnswer = {
  status: "ok" | "no_source" | "out_of_scope";
  // (보관함의 예전 보고서에는 US 칸이 없지만, 보고서 화면은 이 칸을 읽지 않는다)
  countries: { KR: CountryAnswer; JP: CountryAnswer; CN: CountryAnswer; US: CountryAnswer };
  sources: Source[];
  suggestions: string[];
};

// 답변 상태: 기다리는 중 / 도착 / 오류
export type Reply =
  | { state: "loading" }
  | { state: "done"; answer: ApiAnswer }
  | { state: "error"; message: string };

export type Message = {
  id: number;
  question: string;
  reply: Reply;
};

export const COUNTRY_COLUMNS = [
  ["KR", "한국"],
  ["JP", "일본"],
  ["CN", "중국"],
  ["US", "미국"],
] as const;

export const ROWS = [
  ["overview", "제도 개요"],
  ["regulation", "주요 규제"],
  ["recent", "최근 변경"],
] as const;

// /api/report가 돌려주는 보고서 글 (lib/ask-report.ts의 ReportBody와 같은 모양, 샘플 보고서의 구성)
// 문장 안의 **굵게**는 화면에서 굵은 글씨로 바뀐다.
export type ReportPoint = { text: string; note: string | null; sourceNumbers: number[] };
export type ReportItem = {
  title: string; // 검토과제 이름
  directions: string[]; // 기본 방향 박스의 ◇ 문장
  overview: { lead: string; subs: string[]; arrow: string | null }[]; // (1) 주요 내용
  compare: {
    label: "제도 개요" | "주요 규제" | "최근 변경";
    KR: string | null;
    JP: string | null;
    CN: string | null;
    US: string | null;
  }[]; // (2) 국가별 비교 표
  details: { country: "KR" | "JP" | "CN" | "US"; lead: string; points: ReportPoint[]; sourceNumbers: number[] }[]; // (3) 세부 내용
  cautions: { lead: string; subs: string[] }[]; // (4) 유의사항
};
export type ReportData = { items: ReportItem[] };
