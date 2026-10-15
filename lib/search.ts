// Design Ref: §3 데이터 흐름 ④ — 질문과 관련 있는 문서 조각을 고른다.
// Plan: 작업 7에서 용어 사전과 문서 저장소(작업 2)를 연결해 실제로 만든다.
// 지금은 등록된 문서가 없으므로 항상 빈 목록을 돌려준다.

import type { Chunk } from "./ask-ai";

export async function findChunks(question: string): Promise<Chunk[]> {
  void question;
  return [];
}
