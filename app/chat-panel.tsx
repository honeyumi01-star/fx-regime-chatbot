"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { COUNTRY_COLUMNS, ROWS, type ApiAnswer, type Message, type Reply, type ReportData } from "./chat-types";
import ReportView, { pickAnswered, type AnsweredItem } from "./report-view";
import { addReport, printReport } from "./report-store";

// Design Ref: §2 화면 구성 — ③ 대화 영역(비교표·출처)과 ④ 입력창, 상태표
// Plan SC: 작업 4·5·8·9·10·11 — 비교표, 칸별 출처, 근거 없음·범위 밖 안내, 오류 시 다시 시도

// 서버에 연결하지 못했을 때(인터넷 끊김 등) 보여 주는 고정 문구
const NETWORK_ERROR_MESSAGE = "답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요";
const REPORT_ERROR_MESSAGE = "보고서를 만들지 못했어요. 잠시 후 다시 시도해 주세요";

export default function ChatPanel({ initialSuggestions }: { initialSuggestions: string[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  // 빈 질문을 보냈을 때 입력창 아래에 보여 주는 안내 (DESIGN 7번 오류 처리)
  const [inputError, setInputError] = useState("");
  // PDF 보고서: 저장 버튼을 누른 순간의 답변·정리된 글·작성일을 묶어 둔다
  const [report, setReport] = useState<{ items: AnsweredItem[]; data: ReportData; date: string } | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 답변을 기다리는 질문이 하나라도 있으면 입력창을 잠가 중복 전송을 막는다
  const isWaiting = messages.some((m) => m.reply.state === "loading");

  // 보고서에 들어갈 답변: 정상 답변만
  const answered = pickAnswered(messages);

  // PDF로 저장: 서버에서 답변을 보고서 줄글로 정리해 받은 뒤, 보고서 화면을 인쇄 창으로 띄운다.
  // 인쇄 창에서 "PDF로 저장"을 고르면 파일이 된다. 최근 답변 5개까지만 담는다.
  async function saveAsPdf() {
    if (answered.length === 0 || reportBusy) return;
    const target = answered.slice(-5);
    setReportBusy(true);
    setReportError("");

    let data: ReportData;
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: target.map((item) => ({ question: item.question, countries: item.answer.countries })),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setReportError(body?.error?.message ?? REPORT_ERROR_MESSAGE);
        setReportBusy(false);
        return;
      }
      data = body as ReportData;
    } catch {
      setReportError(REPORT_ERROR_MESSAGE);
      setReportBusy(false);
      return;
    }

    const now = new Date();
    const date = `${now.getFullYear()}. ${now.getMonth() + 1}.`;
    // 지난 보고서 목록(오른쪽)에서 다시 볼 수 있게 이 브라우저에 보관한다
    addReport({ id: crypto.randomUUID(), createdAt: now.getTime(), date, items: target, data });
    flushSync(() => {
      setReport({ items: target, data, date });
      setReportBusy(false);
    });
    printReport(now.getTime());
  }

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

  // 오류가 난 질문을 같은 내용으로 다시 보낸다
  function retryQuestion(id: number, question: string) {
    if (isWaiting) return;
    updateReply(id, { state: "loading" });
    void sendQuestion(id, question);
  }

  // 입력창과 키워드 예시 버튼이 함께 쓰는 질문 보내기
  function submitQuestion(rawQuestion: string) {
    if (isWaiting) return;

    const question = rawQuestion.trim();
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion(input);
  }

  return (
    <>
    <div className="flex min-h-[34rem] flex-col print:hidden md:min-h-0 rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(25,31,40,0.06)] md:h-full md:p-6">
      {/* PDF 저장: 정상 답변이 하나라도 있어야 누를 수 있다 */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">답변을 정부 보고서 형식으로 정리해 PDF로 저장할 수 있어요</p>
        <button
          type="button"
          onClick={() => void saveAsPdf()}
          disabled={answered.length === 0 || reportBusy}
          title={answered.length === 0 ? "답변이 나오면 저장할 수 있어요" : "인쇄 창에서 대상을 PDF로 저장으로 고르세요"}
          className="shrink-0 rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand-strong transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {reportBusy ? "보고서 작성 중…" : "PDF로 저장"}
        </button>
      </div>
      {reportError && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {reportError}
        </p>
      )}

      {/* ③ 대화 영역: 질문과 답변이 위에서 아래로 쌓인다. aria-live로 새 답변을 화면 읽기 프로그램에 알린다 */}
      <section
        aria-label="대화"
        aria-live="polite"
        className="flex-1 overflow-y-auto rounded-2xl bg-background p-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-lg font-semibold text-foreground">
              어떤 외환제도가 궁금하세요?<br />
              <span className="text-base font-normal text-muted">키워드를 입력하거나 아래에서 골라 보세요.</span>
            </p>
            <SuggestionButtons keywords={initialSuggestions} disabled={isWaiting} onPick={submitQuestion} />
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((message) => (
              <li key={message.id} className="flex flex-col gap-2">
                {/* 내 질문 */}
                <p className="self-end rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-white">
                  {message.question}
                </p>
                {/* 챗봇 답변 */}
                <ReplyView
                  reply={message.reply}
                  disabled={isWaiting}
                  onRetry={() => retryQuestion(message.id, message.question)}
                  onPickKeyword={submitQuestion}
                />
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
          maxLength={300}
          onChange={(event) => {
            setInput(event.target.value);
            setInputError("");
          }}
          placeholder="키워드나 질문을 입력하세요"
          aria-label="질문 입력"
          className="min-w-0 flex-1 rounded-2xl border border-line bg-white px-5 py-3.5 text-foreground outline-none placeholder:text-zinc-400 focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isWaiting}
          className="rounded-2xl bg-brand px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          보내기
        </button>
      </form>
      {inputError && (
        <p role="alert" className="mt-2 px-5 text-sm text-red-600">
          {inputError}
        </p>
      )}
      <p className="mt-2 px-2 text-xs text-muted">
        각 질문은 독립적으로 처리돼요. 이전 질문은 반영되지 않아요. (질문은 300자까지)
      </p>
    </div>
    {/* 인쇄할 때만 보이는 보고서 */}
    {report && <ReportView items={report.items} report={report.data} date={report.date} />}
    </>
  );
}

// 키워드 예시 버튼: 누르면 그 키워드로 바로 질문한다
function SuggestionButtons({
  keywords,
  disabled,
  onPick,
}: {
  keywords: string[];
  disabled: boolean;
  onPick: (keyword: string) => void;
}) {
  if (keywords.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {keywords.map((keyword) => (
        <button
          key={keyword}
          type="button"
          disabled={disabled}
          onClick={() => onPick(keyword)}
          className="rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand-strong transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {keyword}
        </button>
      ))}
    </div>
  );
}

// 챗봇 답변 한 개를 상태에 맞게 보여 준다
function ReplyView({
  reply,
  disabled,
  onRetry,
  onPickKeyword,
}: {
  reply: Reply;
  disabled: boolean;
  onRetry: () => void;
  onPickKeyword: (keyword: string) => void;
}) {
  const bubble =
    "self-start rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-[0_1px_4px_rgba(25,31,40,0.08)]";

  if (reply.state === "loading") {
    return (
      <p className={`${bubble} animate-pulse text-muted`}>
        자료를 찾아 정리하고 있어요…
      </p>
    );
  }

  if (reply.state === "error") {
    return (
      <div role="alert" className={`${bubble} flex flex-col items-start gap-2`}>
        <p className="text-red-600">{reply.message}</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={disabled}
          className="rounded-full bg-brand-soft px-4 py-1.5 text-sm font-medium text-brand-strong hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const { status, countries, sources, suggestions } = reply.answer;

  // 근거 없음 / 범위 밖: 안내 문구와 키워드 예시
  if (status === "no_source" || status === "out_of_scope") {
    return (
      <div className={`${bubble} flex flex-col gap-3 text-foreground`}>
        <p>
          {status === "no_source"
            ? "근거 문서를 찾지 못했습니다"
            : "한국·일본·중국·미국의 외환제도만 다룹니다"}
        </p>
        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">이런 키워드로 물어보세요</p>
            <SuggestionButtons keywords={suggestions} disabled={disabled} onPick={onPickKeyword} />
          </div>
        )}
      </div>
    );
  }

  // 정상 답변: 한·일·중 비교표 + 칸마다 출처 번호 + 출처 목록
  return (
    <div className={`${bubble} flex w-full flex-col gap-3 text-foreground`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-20 border border-line bg-brand-soft p-2" />
              {COUNTRY_COLUMNS.map(([code, label]) => (
                <th
                  key={code}
                  className="border border-line bg-brand-soft p-2 text-left font-semibold text-brand-strong"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([key, rowLabel]) => (
              <tr key={key}>
                <th className="border border-line bg-brand-soft p-2 text-left align-top font-semibold text-brand-strong">
                  {rowLabel}
                </th>
                {COUNTRY_COLUMNS.map(([code]) => {
                  const cell = countries[code][key];
                  return (
                    <td key={code} className="border border-line p-2 align-top">
                      {cell ? (
                        <>
                          {cell.text}{" "}
                          <span className="whitespace-nowrap text-xs font-semibold text-brand">
                            {cell.sourceNumbers.map((n) => `[${n}]`).join("")}
                          </span>
                        </>
                      ) : (
                        <span className="text-zinc-400">해당 자료 없음</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sources.length > 0 && (
        <ol className="flex flex-col gap-1 text-xs text-muted" aria-label="출처">
          {sources.map((source) => (
            <li key={source.number}>
              [{source.number}] {source.docTitle} · {source.institution} · 기준일 {source.asOf} ·{" "}
              {source.heading}
              {source.sourceUrl.startsWith("http") && (
                <>
                  {" "}
                  <a
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline"
                  >
                    원문
                  </a>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
