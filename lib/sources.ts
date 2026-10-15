// Design Ref: §3 데이터 흐름 ⑦⑧ — AI가 고른 조각 번호를 검사하고 문서명·기관명·기준일·조항 정보로 바꾼다.
// 출처는 AI가 쓰지 않고, 우리가 저장해 둔 문서 정보에서만 가져온다.

import type { Answer } from "./ask-ai";
import type { DocMeta, StoredChunk } from "./documents";

export type Source = {
  number: number; // 화면에 보이는 출처 번호 [1], [2]
  chunkId: string;
  docTitle: string;
  institution: string;
  asOf: string;
  heading: string; // 조항 또는 절 제목
  sourceUrl: string;
};

// 화면으로 내보낼 답변: 칸마다 출처 번호(sourceNumbers)가 붙는다
export type CheckedCell = { text: string; sourceNumbers: number[] } | null;
export type CheckedCountry = {
  overview: CheckedCell;
  regulation: CheckedCell;
  recent: CheckedCell;
};
export type CheckedAnswer = {
  status: Answer["status"];
  countries: { KR: CheckedCountry; JP: CheckedCountry; CN: CheckedCountry };
  sources: Source[];
};

const CELL_KEYS = ["overview", "regulation", "recent"] as const;
const COUNTRY_KEYS = ["KR", "JP", "CN"] as const;

export function emptyCountry(): CheckedCountry {
  return { overview: null, regulation: null, recent: null };
}

// 이번 질문에 AI에게 보낸 조각(sent) 안의 번호이고, 칸의 나라와 같은 나라의 조각일 때만 근거로 인정한다.
// 근거가 하나도 안 남은 칸은 null("해당 자료 없음")로 바꾼다. (DESIGN §3 검사 처리)
export function checkAnswer(answer: Answer, sent: StoredChunk[], docs: DocMeta[]): CheckedAnswer {
  const byId = new Map(sent.map((chunk) => [chunk.id, chunk]));
  const docById = new Map(docs.map((doc) => [doc.id, doc]));
  const sources: Source[] = [];
  const numberOf = new Map<string, number>();

  function sourceNumber(chunk: StoredChunk): number {
    const existing = numberOf.get(chunk.id);
    if (existing) return existing;
    const doc = docById.get(chunk.docId);
    const number = sources.length + 1;
    sources.push({
      number,
      chunkId: chunk.id,
      docTitle: doc?.title ?? chunk.docId,
      institution: doc?.institution ?? "",
      asOf: doc?.asOf ?? "",
      heading: chunk.heading,
      sourceUrl: doc?.sourceUrl ?? "",
    });
    numberOf.set(chunk.id, number);
    return number;
  }

  const countries = { KR: emptyCountry(), JP: emptyCountry(), CN: emptyCountry() };

  if (answer.status === "ok") {
    for (const country of COUNTRY_KEYS) {
      for (const key of CELL_KEYS) {
        const cell = answer.countries[country][key];
        if (!cell || !cell.text.trim()) continue;
        const valid = [...new Set(cell.chunkIds)]
          .map((id) => byId.get(id))
          .filter((chunk): chunk is StoredChunk => !!chunk && chunk.country === country);
        if (valid.length === 0) continue; // 근거가 없는 칸은 비운다
        countries[country][key] = {
          text: cell.text.trim(),
          sourceNumbers: valid.map(sourceNumber),
        };
      }
    }
  }

  const hasAnyCell = COUNTRY_KEYS.some((country) =>
    CELL_KEYS.some((key) => countries[country][key] !== null),
  );
  // ok라고 했지만 검사 뒤에 남은 칸이 하나도 없으면 근거 없음으로 바꾼다
  const status: Answer["status"] =
    answer.status === "ok" && !hasAnyCell ? "no_source" : answer.status;

  return { status, countries, sources };
}
