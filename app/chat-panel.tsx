"use client";

import { useEffect, useRef, useState } from "react";

// Design Ref: §2 화면 구성 — ③ 대화 영역과 ④ 입력창, 상태표(답변을 만드는 중)
// Plan SC: 작업 4 화면 뼈대 + 답변을 기다리는 동안 로딩 표시

type Cell = { text: string; chunkIds: string[] } | null;
type CountryAnswer = { overview: Cell; regulation: Cell; recent: Cell };
type ApiAnswer = {
  status: "ok" | "no_source" | "out_of_scope";
  countries: { KR: CountryAnswer; JP: CountryAnswer; CN: CountryAnswer };
};

// 답변 상태: 기다리는 중 / 도착 / 오류
type Reply =
  | { state: "loading" }
  | { state: "done"; answer: ApiAnswer }
  | { state: "error"; message: string };

type Message = {
  id: number;
  question: string;
  reply: Reply;
};

const COUNTRY_LABELS = [
  ["KR", "한국"],
  ["JP", "일본"],
  ["CN", "중국"],
] as const;

const CELL_LABELS = [
  ["overview", "제도 개요"],
  ["regulation", "주요 규제"],
  ["recent", "최근 변경"],
] as const;

// 서버에 연결하지 못했을 때(인터넷 끊김 등) 보여 주는 고정 문구
const NETWORK_ERROR_MESSAGE = "답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요";

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  // 빈 질문을 보냈을 때 입력창 아래에 보여 주는 안내 (DESIGN 7번 오류 처리)
  const [inputError, setInputError] = useState("");
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 답변을 기다리는 질문이 하나라도 있으면 입력창을 잠가 중복 전송을 막는다
  const isWaiting = messages.some((m) => m.reply.state === "loading");

  // 새 질문이나 답변이 생기면 대화 영역을 맨 아래로 내린다
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function updateReply(id: number, reply: Reply) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, reply } : m)));
  }

  async function sendQuestion(id: number, question: string) {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();

      if (!response.ok) {
        // 서버가 준 고정 안내 문구를 그대로 보여 준다
        updateReply(id, {
          state: "error",
          message: data?.error?.message ?? NETWORK_ERROR_MESSAGE,
        });
        return;
      }
      updateReply(id, { state: "done", answer: data as ApiAnswer });
    } catch {
      updateReply(id, { state: "error", message: NETWORK_ERROR_MESSAGE });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isWaiting) return;

    const question = input.trim();
    if (!question) {
      setInputError("질문을 입력해 주세요");
      return;
    }

    const id = nextId.current++;
    setInputError("");
    setMessages((prev) => [...prev, { id, question, reply: { state: "loading" } }]);
    setInput("");
    void sendQuestion(id, question);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ③ 대화 영역: 질문과 답변이 위에서 아래로 쌓인다. aria-live로 새 답변을 화면 읽기 프로그램에 알린다 */}
      <section
        aria-label="대화"
        aria-live="polite"
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
                {/* 챗봇 답변 */}
                <ReplyView reply={message.reply} />
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </section>

      {/* ④ 입력창: 질문을 적고 보내기 버튼을 누른다. 답변을 기다리는 동안은 잠긴다 */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          disabled={isWaiting}
          onChange={(event) => {
            setInput(event.target.value);
            setInputError("");
          }}
          placeholder="키워드나 질문을 입력하세요"
          aria-label="질문 입력"
          className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 text-black outline-none focus:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-100"
        />
        <button
          type="submit"
          disabled={isWaiting}
          className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          보내기
        </button>
      </form>
      {inputError && (
        <p role="alert" className="mt-2 px-5 text-sm text-red-600 dark:text-red-400">
          {inputError}
        </p>
      )}
    </div>
  );
}

// 챗봇 답변 한 개를 상태에 맞게 보여 준다
function ReplyView({ reply }: { reply: Reply }) {
  const bubble =
    "self-start rounded-2xl border border-zinc-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800";

  if (reply.state === "loading") {
    return (
      <p className={`${bubble} animate-pulse text-zinc-500 dark:text-zinc-400`}>
        자료를 찾아 정리하고 있어요…
      </p>
    );
  }

  if (reply.state === "error") {
    return (
      <p role="alert" className={`${bubble} text-red-600 dark:text-red-400`}>
        {reply.message}
      </p>
    );
  }

  const { status, countries } = reply.answer;

  if (status === "no_source") {
    return <p className={`${bubble} text-zinc-700 dark:text-zinc-300`}>근거 문서를 찾지 못했습니다</p>;
  }
  if (status === "out_of_scope") {
    return (
      <p className={`${bubble} text-zinc-700 dark:text-zinc-300`}>
        한국·일본·중국의 외환제도만 다룹니다
      </p>
    );
  }

  // 정상 답변: 비교표와 출처 표시는 이후 작업에서 만든다. 지금은 나라별로 글만 보여 준다.
  return (
    <div className={`${bubble} flex flex-col gap-3 text-zinc-800 dark:text-zinc-200`}>
      {COUNTRY_LABELS.map(([code, label]) => {
        const country = countries[code];
        return (
          <div key={code}>
            <p className="font-semibold">{label}</p>
            {CELL_LABELS.map(([key, cellLabel]) => (
              <p key={key} className="text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">{cellLabel}: </span>
                {country[key]?.text ?? "해당 자료 없음"}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
