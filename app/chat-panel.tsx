"use client";

import { useEffect, useRef, useState } from "react";

// Design Ref: §2 화면 구성 — ③ 대화 영역과 ④ 입력창
// Plan SC: 작업 4 — 질문 입력창과 답변 영역이 있는 챗봇 화면 뼈대

type Message = {
  id: number;
  question: string;
};

export default function ChatPanel() {
  // 지금까지 주고받은 질문 목록 (답변 기능은 작업 6 이후에 연결한다)
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 질문이 생기면 대화 영역을 맨 아래로 내린다
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;

    setMessages((prev) => [...prev, { id: nextId.current++, question }]);
    setInput("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ③ 대화 영역: 질문과 답변이 위에서 아래로 쌓인다 */}
      <section
        aria-label="대화"
        className="flex-1 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-zinc-500 dark:text-zinc-400">
            한국·일본·중국의 외환제도에 대해 궁금한 키워드를 입력해 보세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((message) => (
              <li key={message.id} className="flex flex-col gap-2">
                {/* 내 질문 */}
                <p className="self-end rounded-2xl bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {message.question}
                </p>
                {/* 챗봇 답변 자리 (비교표와 출처는 이후 작업에서 채운다) */}
                <p className="self-start rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  답변 기능은 아직 연결되지 않았어요.
                </p>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </section>

      {/* ④ 입력창: 질문을 적고 보내기 버튼을 누른다 */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="키워드나 질문을 입력하세요"
          aria-label="질문 입력"
          className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 text-black outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-100"
        />
        <button
          type="submit"
          disabled={input.trim() === ""}
          className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          보내기
        </button>
      </form>
    </div>
  );
}
