import { COUNTRY_COLUMNS, ROWS, type ApiAnswer, type Cell, type Message } from "./chat-types";

// PDF 보고서 화면: 평소에는 숨어 있고, 인쇄(PDF로 저장)할 때만 보인다.
// 정부 보고서 형식: 제목 → 검토 개요(Ⅰ) → 질문별 검토 내용(Ⅱ) → 유의사항(Ⅲ), 기호는 □ ○ ―
// 내용은 챗봇이 이미 보여 준 답변만 쓴다. 새로 지어내거나 AI를 다시 부르지 않는다.

type AnsweredItem = { question: string; answer: ApiAnswer };

// 완성된 정상 답변만 모은다 (로딩·오류·근거 없음·범위 밖은 보고서에 넣지 않는다)
export function pickAnswered(messages: Message[]): AnsweredItem[] {
  const items: AnsweredItem[] = [];
  for (const m of messages) {
    if (m.reply.state === "done" && m.reply.answer.status === "ok") {
      items.push({ question: m.question, answer: m.reply.answer });
    }
  }
  return items;
}

// 요약용: 칸 내용의 첫 문장만 뽑는다 (문장이 없으면 앞부분만)
function firstSentence(text: string): string {
  const match = text.match(/^.*?[.。](?=\s|$)/);
  const sentence = (match ? match[0] : text).trim();
  return sentence.length > 140 ? `${sentence.slice(0, 140)}…` : sentence;
}

const marks = (cell: NonNullable<Cell>) => cell.sourceNumbers.map((n) => `[${n}]`).join("");

// 나라별 핵심 요약 한 줄: 제도 개요가 있으면 그것, 없으면 주요 규제, 그것도 없으면 최근 변경
function summaryOf(answer: ApiAnswer, code: "KR" | "JP" | "CN") {
  const c = answer.countries[code];
  const cell = c.overview ?? c.regulation ?? c.recent;
  return cell ? `${firstSentence(cell.text)} ${marks(cell)}` : null;
}

export default function ReportView({ items, date }: { items: AnsweredItem[]; date: string }) {
  return (
    <article
      aria-hidden="true"
      className="report hidden text-[11pt] leading-relaxed text-black print:block"
    >
      <p className="text-right text-[9pt]">참고용 검토 자료 (공식 해석 아님)</p>
      <h1 className="mt-2 mb-6 border-y-2 border-black py-4 text-center text-[20pt] font-bold">
        한·중·일 외환제도 비교 검토 보고서
      </h1>

      <table className="mb-6 w-full border-collapse text-[10pt]">
        <tbody>
          <tr>
            <th className="w-24 border border-black bg-[#efefef] p-1.5 text-center">작성일</th>
            <td className="border border-black p-1.5">{date}</td>
            <th className="w-24 border border-black bg-[#efefef] p-1.5 text-center">검토 질문</th>
            <td className="border border-black p-1.5">{items.length}건</td>
          </tr>
          <tr>
            <th className="border border-black bg-[#efefef] p-1.5 text-center">작성 방식</th>
            <td colSpan={3} className="border border-black p-1.5">
              한중일 외환제도 분석 챗봇 답변을 정리함 (담당자 검토 전)
            </td>
          </tr>
        </tbody>
      </table>

      <h2 className="mb-2 text-[14pt] font-bold">Ⅰ. 검토 개요</h2>
      <ul className="mb-6 space-y-1">
        <li>□ 검토 목적</li>
        <li className="pl-5">○ 한국·일본·중국의 외환제도를 같은 기준(제도 개요·주요 규제·최근 변경)으로 비교</li>
        <li>□ 검토 방법</li>
        <li className="pl-5">○ 등록된 근거 문서(법령·기관 자료)에 있는 내용만 정리하고, 모든 내용에 근거 번호를 붙임</li>
        <li>□ 검토 질문</li>
        {items.map((item, i) => (
          <li key={i} className="pl-5">
            ○ {item.question}
          </li>
        ))}
      </ul>

      <h2 className="mb-2 text-[14pt] font-bold">Ⅱ. 검토 내용</h2>
      {items.map((item, i) => (
        <section key={i} className="mb-6">
          <h3 className="mb-2 text-[12pt] font-bold">
            {i + 1}. {item.question}
          </h3>

          <p className="font-semibold">가. 핵심 요약</p>
          <ul className="mb-3 space-y-1">
            {COUNTRY_COLUMNS.map(([code, label]) => {
              const line = summaryOf(item.answer, code);
              return (
                <li key={code}>
                  □ {label}: {line ?? "해당 자료 없음"}
                </li>
              );
            })}
          </ul>

          <p className="font-semibold">나. 상세 비교</p>
          <table className="mb-3 w-full table-fixed border-collapse text-[9.5pt]">
            <thead>
              <tr>
                <th className="w-16 border border-black bg-[#efefef] p-1.5" />
                {COUNTRY_COLUMNS.map(([code, label]) => (
                  <th key={code} className="border border-black bg-[#efefef] p-1.5">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([key, rowLabel]) => (
                <tr key={key} className="break-inside-avoid">
                  <th className="border border-black bg-[#efefef] p-1.5 align-top">{rowLabel}</th>
                  {COUNTRY_COLUMNS.map(([code]) => {
                    const cell = item.answer.countries[code][key];
                    return (
                      <td key={code} className="border border-black p-1.5 align-top">
                        {cell ? `${cell.text} ${marks(cell)}` : "해당 자료 없음"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="font-semibold">다. 근거 자료</p>
          <ul className="space-y-0.5 text-[9.5pt]">
            {item.answer.sources.map((s) => (
              <li key={s.number}>
                ― [{s.number}] {s.docTitle}, {s.institution}, 기준일 {s.asOf}, {s.heading}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <h2 className="mb-2 text-[14pt] font-bold">Ⅲ. 유의사항</h2>
      <ul className="space-y-1">
        <li>○ 이 보고서는 참고용이며 공식 해석이 아님</li>
        <li>○ 근거 문서에 없는 내용은 포함하지 않았으며, 자료가 없는 칸은 &quot;해당 자료 없음&quot;으로 표시함</li>
        <li>○ 근거 문서의 정리·번역은 담당자 확인 전 단계일 수 있으므로 중요한 판단 전에 원문을 확인할 것</li>
        <li>○ 환율 전망·투자 조언·법률 자문을 포함하지 않음</li>
      </ul>
    </article>
  );
}
