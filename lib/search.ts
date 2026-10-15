// Design Ref: §3 데이터 흐름 ③④ — 용어 사전으로 질문을 넓혀 관련 있는 문서 조각을 고른다.
// Plan: 작업 7 — 용어 사전을 쓰는 조각 찾기. 별도 검색 서비스 없이 단순한 글자 맞춤 방식을 쓴다.

import fs from "node:fs/promises";
import path from "node:path";
import { loadDocuments, type StoredChunk } from "./documents";

// 질문마다 나라별로 가져올 조각 수 (3개국 × 2 = 최대 6개, DESIGN §3 ④)
const PER_COUNTRY = 2;

type GlossaryGroup = { name: string; terms: string[] };

let glossaryCache: Promise<GlossaryGroup[]> | null = null;

// 같은 개념을 나라마다 달리 부르는 한국어 표현 묶음 (data/glossary.json)
function loadGlossary(): Promise<GlossaryGroup[]> {
  glossaryCache ??= fs
    .readFile(path.join(process.cwd(), "data", "glossary.json"), "utf8")
    .then((raw) => (JSON.parse(raw) as { groups: GlossaryGroup[] }).groups)
    .catch(() => []); // 사전이 없어도 검색은 동작한다
  return glossaryCache;
}

// 화면에 보여 줄 키워드 예시: 용어 사전의 대표 표현 (AI가 만들지 않는다)
export async function getSuggestions(limit = 4): Promise<string[]> {
  return (await loadGlossary()).slice(0, limit).map((group) => group.name);
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, "");

// 질문에서 찾을 말: 질문 속 낱말 + 용어 사전에서 같은 개념으로 묶인 표현
async function buildTerms(question: string) {
  const strong = new Set<string>(); // 낱말과 사전 표현 (가중치 큼)
  const weak = new Set<string>(); // 낱말의 두 글자 조각 (조사·어미가 붙어도 맞추려고)

  for (const word of question.split(/[\s,.?!~·()'"]+/)) {
    if (word.length < 2) continue;
    strong.add(normalize(word));
    for (let i = 0; i < word.length - 1; i++) weak.add(normalize(word.slice(i, i + 2)));
  }

  const flatQuestion = normalize(question);
  for (const group of await loadGlossary()) {
    const all = [group.name, ...group.terms].map(normalize);
    if (all.some((term) => flatQuestion.includes(term))) all.forEach((term) => strong.add(term));
  }
  return { strong: [...strong], weak: [...weak] };
}

function countOccurrences(haystack: string, needle: string, cap = 5): number {
  let count = 0;
  let from = 0;
  while (count < cap) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    count++;
    from = index + needle.length;
  }
  return count;
}

export async function findChunks(question: string): Promise<StoredChunk[]> {
  const { chunks } = await loadDocuments();
  const { strong, weak } = await buildTerms(question);
  if (chunks.length === 0 || strong.length === 0) return [];

  const prepared = chunks.map((chunk) => ({
    chunk,
    heading: normalize(chunk.heading),
    text: normalize(chunk.text),
  }));

  // 여러 조각에 흔히 나오는 말(예: "환율")은 점수를 낮추고, 드문 말(예: "자유변동환율")은 높인다
  const weight = (term: string) => {
    const containing = prepared.filter((p) => p.heading.includes(term) || p.text.includes(term)).length;
    return Math.log(1 + prepared.length / Math.max(containing, 1));
  };
  const strongWeights = strong.map((term) => [term, weight(term)] as const);
  const weakWeights = weak.map((term) => [term, weight(term)] as const);

  const scored = prepared.map(({ chunk, heading, text }) => {
    let score = 0;
    for (const [term, w] of strongWeights) {
      if (heading.includes(term)) score += 4 * w;
      score += countOccurrences(text, term, 3) * 2 * w;
    }
    for (const [term, w] of weakWeights) {
      if (heading.includes(term)) score += 1 * w;
      score += countOccurrences(text, term, 3) * 0.3 * w;
    }
    return { chunk, score };
  });

  // 나라별로 점수가 높은 순서대로 가져온다. 점수가 0이면 관련 없는 조각이라 뺀다.
  const picked: StoredChunk[] = [];
  for (const country of ["KR", "JP", "CN"] as const) {
    scored
      .filter((item) => item.chunk.country === country && item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, PER_COUNTRY)
      .forEach((item) => picked.push(item.chunk));
  }
  return picked;
}
