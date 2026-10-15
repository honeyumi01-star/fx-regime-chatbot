import { getSuggestions } from "@/lib/search";
import ChatPanel from "./chat-panel";

// Design Ref: §2 화면 구성 — ① 제목 + ③④ 대화 영역과 입력창
export default async function Home() {
  // 처음 화면의 키워드 예시는 용어 사전의 대표 표현에서 서버가 고른다
  const suggestions = await getSuggestions();

  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-8">
      {/* 앱 이름: 화면 맨 위에 보이는 큰 제목 */}
      <h1 className="mb-4 text-3xl font-bold tracking-tight text-black sm:text-4xl dark:text-zinc-50">
        한중일 외환제도 분석 챗봇
      </h1>
      {/* ② 안내 문구: 항상 보인다 (DESIGN §2, PRD §7) */}
      <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        ⚠ 답변은 참고용이며 공식 해석이 아닙니다. 개인정보는 입력하지 마세요. 질문 내용은 답변을 만들기 위해
        OpenAI로 전송됩니다.
      </p>
      <ChatPanel initialSuggestions={suggestions} />
    </main>
  );
}
