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
  countries: { KR: CountryAnswer; JP: CountryAnswer; CN: CountryAnswer };
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
] as const;

export const ROWS = [
  ["overview", "제도 개요"],
  ["regulation", "주요 규제"],
  ["recent", "최근 변경"],
] as const;
