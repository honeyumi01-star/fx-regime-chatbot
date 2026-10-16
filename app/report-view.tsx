import type { ApiAnswer, Message, ReportData } from "./chat-types";
import { COUNTRY_COLUMNS } from "./chat-types";

// PDF 보고서 화면: 평소에는 숨어 있고, 인쇄(PDF로 저장)할 때만 보인다.
// 형식은 정부 부처 전략계획 보고서를 따른다: 표지 → 목차 → Ⅰ·Ⅱ·Ⅲ 대제목 → (1)(2) 중제목 → □ ○ - * 기호.
// 글꼴(globals.css의 .rpt-*): 제목 HY헤드라인M, 본문 바탕체(명조), 각주 굴림. 컴퓨터에 없으면 비슷한 글꼴로 대신 나온다.

export type AnsweredItem = { question: string; answer: ApiAnswer };

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

const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"];
const COUNTRY_LABEL = Object.fromEntries(COUNTRY_COLUMNS) as Record<"KR" | "JP" | "CN" | "US", string>;
const marks = (nums: number[]) => (nums.length ? ` [${nums.join(", ")}]` : "");

// 대제목: 남색 네모 안의 로마숫자 + 제목, 위아래 줄
function Chapter({ no, title }: { no: number; title: string }) {
  return (
    <div className="rpt-head mb-6 flex items-center gap-3 border-y-2 border-[#3b4a6b] py-1.5 text-[16pt]">
      <span className="bg-[#1f2d4d] px-2 text-white">{ROMAN[no]}</span>
      <span>{title}</span>
    </div>
  );
}

// 중제목: 파란 바탕에 흰 글씨
function Section({ label }: { label: string }) {
  return (
    <div className="rpt-head mt-5 mb-3 w-fit bg-[#1a3df0] px-3 py-1 text-[13pt] text-white">{label}</div>
  );
}

export default function ReportView({
  items,
  report,
  date,
  preview = false,
}: {
  items: AnsweredItem[];
  report: ReportData | null;
  date: string;
  // true면 화면에서도 종이 모양으로 보이고, false면 인쇄할 때만 보인다
  preview?: boolean;
}) {
  if (!report || report.items.length !== items.length) return null;

  const first = report.items[0].title;
  const subtitle = report.items.length > 1 ? `${first} 외 ${report.items.length - 1}건` : first;

  return (
    <article
      aria-hidden={preview ? undefined : "true"}
      className={`rpt-body text-[13pt] leading-[1.75] text-black ${
        preview
          ? "mx-auto block w-full max-w-[210mm] bg-white px-[14mm] py-[12mm] shadow-[0_4px_20px_rgba(25,31,40,0.12)] print:max-w-none print:p-0 print:shadow-none"
          : "hidden print:block"
      }`}
    >
      {/* 표지 */}
      <section className="flex min-h-[250mm] break-after-page flex-col items-center justify-between py-[40mm] text-center">
        <div className="w-full" />
        <div className="w-full">
          <div className="h-[5px] w-full bg-[#5c8df0]" />
          <h1 className="rpt-head my-8 text-[30pt] leading-tight">주요 국가 외환제도 비교 검토</h1>
          <p className="rpt-head -mt-4 mb-8 text-[18pt]">({subtitle})</p>
          <div className="h-[5px] w-full bg-[#5c8df0]" />
        </div>
        <p className="text-[20pt] font-bold">{date}</p>
      </section>

      {/* 목차 */}
      <section className="break-after-page pt-[10mm]">
        <div className="rpt-head mx-auto mb-10 w-fit rounded-[1.2rem] border-2 border-black px-12 py-3 text-[18pt] tracking-[0.3em]">
          목 차
        </div>
        <ul className="rpt-head space-y-1 text-[14pt]">
          <li className="mt-6">Ⅰ. 검토 개요</li>
          <li className="rpt-body pl-6 text-[12pt]">1. 검토 배경 및 목적</li>
          <li className="rpt-body pl-6 text-[12pt]">2. 검토 방법</li>
          <li className="mt-6">Ⅱ. 검토 내용</li>
          {report.items.map((item, i) => (
            <li key={i} className="rpt-body pl-6 text-[12pt]">
              {i + 1}. {item.title}
            </li>
          ))}
          <li className="mt-6">Ⅲ. 유의사항</li>
        </ul>
      </section>

      {/* Ⅰ. 검토 개요 */}
      <section className="break-after-page">
        <Chapter no={0} title="검토 개요" />
        <Section label="(1) 검토 배경 및 목적" />
        <p className="mb-3">
          □ <b>한국·일본·중국·미국의 외환제도</b>를 같은 기준(제도 개요·주요 규제·최근 변경)으로 비교하여, 외환제도 업무
          검토 시 <b>참고 자료</b>로 활용하고자 함
        </p>
        <Section label="(2) 검토 방법" />
        <p className="mb-2">
          □ 등록된 <b>근거 문서(법령·기관 자료)</b>에 있는 내용만 정리하고, 모든 내용에 근거 번호를 붙임
        </p>
        <p className="mb-2">□ 검토한 질문은 다음과 같음</p>
        {items.map((item, i) => (
          <p key={i} className="mb-1 pl-6">
            ○ {item.question}
          </p>
        ))}
        <p className="rpt-note mt-3 pl-6 text-[10.5pt]">
          * 근거 번호 [n]은 각 검토과제 끝의 근거 자료 목록과 연결됨
        </p>
      </section>

      {/* Ⅱ. 검토 내용 */}
      <Chapter no={1} title="검토 내용" />
      {report.items.map((item, i) => (
        <section key={i} className={i > 0 ? "break-before-page" : ""}>
          <div className="mb-6 flex border-2 border-black text-[14pt]">
            <span className="rpt-head border-r-2 border-black px-3 py-1">검토과제 {i + 1}</span>
            <span className="rpt-head px-3 py-1">{item.title}</span>
          </div>

          {/* 핵심 요약 박스 */}
          <div className="relative mt-8 mb-6 border-2 border-[#3b4a6b] bg-[#e6f4fd] px-5 pt-8 pb-3">
            <span className="rpt-head absolute -top-4 left-1/2 -translate-x-1/2 border-2 border-[#3b4a6b] bg-white px-8 py-0.5 text-[13pt] tracking-[0.3em]">
              핵 심 요 약
            </span>
            {item.summary.map((s, k) => (
              <p key={k} className="mb-3 pl-6 -indent-6">
                ◇ {s.text}
                {marks(s.sourceNumbers)}
              </p>
            ))}
          </div>

          {item.sections.map((sec, k) => (
            <div key={k}>
              <Section label={`(${k + 1}) ${sec.heading}`} />
              {sec.paragraphs.map((p, m) => (
                <div key={m} className="mb-3">
                  <p className="pl-6 -indent-6">
                    □ <b>({COUNTRY_LABEL[p.country]})</b> {p.text}
                    {marks(p.sourceNumbers)}
                  </p>
                  {p.points.map((pt, n) => (
                    <p key={n} className="mt-1 pl-12 -indent-5 text-[12.5pt]">
                      ○ {pt.text}
                      {marks(pt.sourceNumbers)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ))}

          {/* 근거 자료: 각주 형식 */}
          <div className="rpt-note mt-5 border-t border-black pt-2 text-[10pt] leading-snug">
            {items[i].answer.sources.map((s) => (
              <p key={s.number} className="pl-4 -indent-4">
                * [{s.number}] {s.docTitle}, {s.institution}, 기준일 {s.asOf}, {s.heading}
              </p>
            ))}
          </div>
        </section>
      ))}

      {/* Ⅲ. 유의사항 */}
      <section className="mt-10 break-before-page">
        <Chapter no={2} title="유의사항" />
        <p className="mb-2 pl-6 -indent-6">
          □ 이 보고서는 <b>참고용</b>이며 <b>공식 해석이 아님</b>
        </p>
        <p className="mb-2 pl-6 -indent-6">
          □ 근거 문서에 없는 내용은 포함하지 않았으며, 문장 표현은 <b>챗봇이 정리한 것</b>으로 담당자 검토 전 단계임
        </p>
        <p className="mb-2 pl-6 -indent-6">□ 중요한 판단에 앞서 반드시 법령 원문과 소관 기관의 최신 안내를 확인할 필요</p>
        <p className="mb-2 pl-6 -indent-6">□ 환율 전망, 투자 조언, 법률 자문은 포함하지 않음</p>
      </section>
    </article>
  );
}
