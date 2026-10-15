import ChatPanel from "./chat-panel";

// Design Ref: §2 화면 구성 — ① 제목 + ③④ 대화 영역과 입력창
export default function Home() {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-8">
      {/* 앱 이름: 화면 맨 위에 보이는 큰 제목 */}
      <h1 className="mb-4 text-3xl font-bold tracking-tight text-black sm:text-4xl dark:text-zinc-50">
        한중일 외환제도 분석 챗봇
      </h1>
      <ChatPanel />
    </main>
  );
}
