"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ApiAnswer, Message, ReportData, ReportItem } from "./chat-types";

// PDF 보고서 화면. 평소에는 화면 밖에 숨어 있고, 인쇄(PDF로 저장)할 때만 보인다. 지난 보고서 화면에서는 종이 모양으로 보여 준다.
//
// 형식은 기획재정부 「성과관리 전략계획」 보고서(참고용 PDF)를 그대로 따른다.
//   표지(파란 선 2개 + 제목 + 날짜 + 로고·기관명) → 목차(둥근 테두리, 점선, 쪽 번호) → Ⅰ 검토 개요 → Ⅱ 검토 내용 → Ⅲ 유의사항
//   Ⅱ의 한 과제 = 과제 박스 + "핵 심 요 약" 박스 → (1) 주요 내용 → (2) 국가별 비교표 → (3) 세부 내용 → (4) 유의사항 → (5) 참고자료
//   기호: □(요지) → ㅇ(수단·세부) → ➡(결론) → *(각주), 쪽 번호는 아래 가운데 "- 3 -"
//   글꼴: 제목 HY헤드라인M, 본문 휴먼명조 16pt, 각주 맑은 고딕 12pt, 쪽 번호 굴림 10pt (globals.css의 .rpt-*)
// 쪽 나누기를 브라우저에 맡기면 목차의 쪽 번호를 알 수 없으므로, 블록 높이를 재서 A4 한 쪽씩 직접 나눈다.

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

// ───────────── 치수 (샘플 PDF를 측정한 값) ─────────────
const MM = 96 / 25.4; // 1mm = 3.78px
const PT = 96 / 72; // 1pt = 1.33px
const CONTENT_HEIGHT = 249 * MM; // 한 쪽에 본문을 놓을 수 있는 높이 (위 26mm, 아래 22mm 여백)
const PAGE_WIDTH_PX = 210 * MM;

const COUNTRY_LABEL = { KR: "한국", JP: "일본", CN: "중국", US: "미국" } as const;
const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ"];
const NUM_MARK = ["❶", "❷", "❸", "❹", "❺", "❻", "❼", "❽", "❾"];

// ───────────── 글자 꾸미기: **굵게**, 맨 앞 (소제목) ─────────────
function Rich({ text, tag = false }: { text: string; tag?: boolean }) {
  const m = tag ? text.match(/^\(([^)]{1,24})\)\s*([\s\S]*)$/) : null;
  const body = m ? m[2] : text;
  const parts = body.split(/\*\*(.+?)\*\*/g); // 홀수 번째가 굵은 글씨
  return (
    <>
      {m && <b>({m[1]}) </b>}
      {parts.map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

// ───────────── 목록 한 줄 (기호 + 내어쓰기) ─────────────
type Level = "sq" | "circ" | "arrow" | "note" | "num" | "dot" | "dash";
const LEVEL: Record<Level, { indent: number; hang: number; before: number; cls: string }> = {
  sq: { indent: 0, hang: 24, before: 17, cls: "rpt-body text-[16pt] leading-[1.62]" }, // □
  circ: { indent: 8, hang: 24, before: 8, cls: "rpt-body text-[16pt] leading-[1.62]" }, // ㅇ
  arrow: { indent: 8, hang: 24, before: 10, cls: "rpt-body text-[16pt] leading-[1.62]" }, // ➡
  note: { indent: 24, hang: 7, before: 3, cls: "rpt-note text-[12pt] leading-[1.55]" }, // *
  num: { indent: 8, hang: 24, before: 16, cls: "rpt-body text-[16pt] leading-[1.62]" }, // ❶
  dot: { indent: 16, hang: 22, before: 9, cls: "rpt-body text-[16pt] leading-[1.62]" }, // ▪
  dash: { indent: 22, hang: 16, before: 8, cls: "rpt-body text-[16pt] leading-[1.62]" }, // -
};

function Row({ level, mark, children }: { level: Level; mark: string; children: ReactNode }) {
  const l = LEVEL[level];
  return (
    <div className={`flex ${l.cls}`} style={{ marginLeft: `${l.indent}pt` }}>
      <span style={{ width: `${l.hang}pt`, flex: "none" }}>{mark}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ───────────── 제목 모양들 ─────────────
// 대제목: 남색 네모 안의 로마숫자 + 제목, 위아래 줄 (샘플 40쪽)
function ChapterTitle({ no, title }: { no: number; title: string }) {
  return (
    <div className="flex items-center gap-[10pt] border-y-[2.5px] border-[#425a80] py-[5pt]">
      <span className="rpt-body flex h-[26pt] w-[28pt] items-center justify-center bg-[#1f3f66] text-[20pt] text-white">
        {ROMAN[no]}
      </span>
      <span className="rpt-head text-[18pt]">{title}</span>
    </div>
  );
}

// 과제 상자 (샘플 40쪽 "전략목표 Ⅰ │ 제목")
function LabelBox({ label, title }: { label: string; title: string }) {
  return (
    <div className="flex border border-black">
      <span className="rpt-head border-r border-black px-[8pt] py-[3pt] text-[16pt]">{label}</span>
      <span className="rpt-head flex-1 px-[8pt] py-[3pt] text-[16pt]">{title}</span>
    </div>
  );
}

// 쪽 위 제목 (샘플 46쪽 "성과목표 Ⅰ-2  제목" : 테두리 상자 + 제목 아래 줄)
function LabelTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="flex items-end">
      <span className="rpt-head border border-black px-[7pt] py-[2pt] text-[16pt]">{label}</span>
      <span className="rpt-head ml-[3pt] flex-1 border-b border-black px-[7pt] py-[2pt] text-[16pt]">{title}</span>
    </div>
  );
}

// 소제목 B: 파란 바탕에 흰 글씨 (샘플 46쪽 "(1) 주요 내용")
function HeadingB({ text }: { text: string }) {
  return (
    <div className="rpt-head w-fit border border-[#1c1cd0] bg-[#2828f8] px-[8pt] py-[2.5pt] text-[16pt] text-white">
      {text}
    </div>
  );
}

// 소제목 A: 연한 바탕 + 파란 글씨 + 아래 굵은 줄 (샘플 5·6쪽 "(3) 일자리 창출 …")
function HeadingA({ text }: { text: string }) {
  return (
    <div className="rpt-head w-fit border border-[#c8c8b8] border-b-[3px] bg-[#ffffe8] px-[8pt] py-[2.5pt] text-[16pt] text-[#0000ff]">
      {text}
    </div>
  );
}

// "기 본 방 향" 박스 (샘플 40쪽). 우리 보고서에서는 "핵 심 요 약"
function DirectionBox({ items }: { items: string[] }) {
  return (
    <div className="relative border border-[#5b7896] bg-[#e0f8ff] px-[14pt] pt-[30pt] pb-[10pt]">
      <span className="rpt-head absolute -top-[13pt] left-1/2 -translate-x-1/2 border border-[#5b7896] bg-white px-[26pt] py-[2pt] text-[15pt] tracking-[0.35em]">
        핵 심 요 약
      </span>
      {items.map((text, i) => (
        <div key={i} className={`rpt-body flex text-[15pt] leading-[1.6] ${i ? "mt-[17pt]" : ""}`}>
          <span style={{ width: "22pt", flex: "none" }}>◇</span>
          <div>
            <Rich text={text} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────── 근거(각주)와 참고자료 문장 만들기 ─────────────
function shortDocTitle(title: string): string {
  return title.replace(/\s*\(([^)]*)\)/g, (whole, inner: string) => (/U\.S\.C|CFR/.test(inner) ? whole : "")).trim();
}
function cleanHeading(heading: string): string {
  return heading.replace(/\s—\s.*$/, "").replace(/\s*\(\d+\/\d+\)/, "").replace(/\s*제\d+항(~제\d+항)?$/, "").trim();
}
function footnoteOf(answer: ApiAnswer, number: number): string | null {
  const s = answer.sources.find((x) => x.number === number);
  if (!s) return null;
  const doc = shortDocTitle(s.docTitle);
  const head = cleanHeading(s.heading);
  return head.includes(doc.slice(0, 6)) ? head : `${doc} ${head}`;
}
function dateText(asOf: string): string {
  const m = asOf.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}.${Number(m[2])}.${Number(m[3])}` : asOf;
}

// ───────────── 한 과제의 블록 목록 ─────────────
type Block = { key: string; node: ReactNode; space: number; keepNext?: boolean; breakBefore?: boolean; tocId?: string };
const px = (pt: number) => pt * PT;

function itemBlocks(item: ReportItem, answer: ApiAnswer, index: number, first: boolean): Block[] {
  const k = `i${index}`;
  const label = `검토과제 ${index + 1}`;
  const blocks: Block[] = [];

  // 쪽 1: (처음이면 Ⅱ 대제목) + 과제 상자 + 핵심 요약 박스
  if (first) {
    blocks.push({ key: `${k}-ch`, node: <ChapterTitle no={1} title="검토 내용" />, space: 0, breakBefore: true, tocId: "c2" });
    blocks.push({ key: `${k}-box`, node: <LabelBox label={label} title={item.title} />, space: px(22), tocId: `t${index}` });
  } else {
    blocks.push({ key: `${k}-box`, node: <LabelBox label={label} title={item.title} />, space: 0, breakBefore: true, tocId: `t${index}` });
  }
  blocks.push({ key: `${k}-dir`, node: <DirectionBox items={item.directions} />, space: px(34) });

  // 쪽 2~: 쪽 위 제목 + (1) 주요 내용 …
  blocks.push({ key: `${k}-lt`, node: <LabelTitle label={label} title={item.title} />, space: 0, breakBefore: true, keepNext: true });
  blocks.push({ key: `${k}-h1`, node: <HeadingB text="(1) 주요 내용" />, space: px(24), keepNext: true });
  item.overview.forEach((o, i) => {
    blocks.push({
      key: `${k}-o${i}`,
      node: (
        <Row level="sq" mark="□">
          <Rich text={o.lead} tag />
        </Row>
      ),
      space: px(i === 0 ? 14 : LEVEL.sq.before),
      keepNext: o.subs.length > 0,
    });
    o.subs.forEach((s, j) =>
      blocks.push({
        key: `${k}-o${i}s${j}`,
        node: (
          <Row level="circ" mark="ㅇ">
            <Rich text={s} />
          </Row>
        ),
        space: px(LEVEL.circ.before),
      }),
    );
    if (o.arrow)
      blocks.push({
        key: `${k}-o${i}a`,
        node: (
          <Row level="arrow" mark="➡">
            <Rich text={o.arrow.replace(/^\s*➡\s*/, "")} />
          </Row>
        ),
        space: px(LEVEL.arrow.before),
      });
  });

  // (2) 국가별 비교 표
  if (item.compare.length > 0) {
    blocks.push({ key: `${k}-h2`, node: <HeadingB text="(2) 국가별 비교" />, space: px(28), keepNext: true });
    blocks.push({
      key: `${k}-tb`,
      node: (
        <div>
          <p className="rpt-body mb-[6pt] text-center text-[15pt]">&lt; 국가별 비교표 &gt;</p>
          <table className="rpt-note w-full table-fixed border-collapse text-[10pt] leading-[1.4]">
            <thead>
              <tr>
                <th className="w-[12%] border border-black bg-[#d9d9d9] py-[3pt] font-normal">구분</th>
                {(["KR", "JP", "CN", "US"] as const).map((c) => (
                  <th key={c} className="border border-black bg-[#d9d9d9] py-[3pt] font-normal">
                    {COUNTRY_LABEL[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {item.compare.map((row) => (
                <tr key={row.label}>
                  <td className="border border-black bg-[#f2f2f2] px-[4pt] py-[4pt] text-center align-middle">{row.label}</td>
                  {(["KR", "JP", "CN", "US"] as const).map((c) => (
                    <td key={c} className="border border-black px-[5pt] py-[4pt] align-top">
                      {row[c] ?? "해당 자료 없음"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
      space: px(14),
    });
  }

  // (3) 세부 내용: 나라마다 □ 요지 + ㅇ 세부 + * 근거
  if (item.details.length > 0) {
    blocks.push({ key: `${k}-h3`, node: <HeadingB text="(3) 세부 내용" />, space: px(30), keepNext: true });
    item.details.forEach((d, i) => {
      const country = COUNTRY_LABEL[d.country];
      blocks.push({
        key: `${k}-d${i}`,
        node: (
          <Row level="sq" mark="□">
            <b>({country}) </b>
            <Rich text={d.lead} />
          </Row>
        ),
        space: px(i === 0 ? 14 : LEVEL.sq.before),
        keepNext: d.points.length > 0,
      });
      d.points.forEach((p, j) => {
        const noteLines = p.note ? [p.note] : [];
        blocks.push({
          key: `${k}-d${i}p${j}`,
          node: (
            <>
              <Row level="circ" mark="ㅇ">
                <Rich text={p.text} />
              </Row>
              {noteLines.map((n, x) => (
                <div key={x} style={{ paddingTop: `${px(LEVEL.note.before)}px` }}>
                  <Row level="note" mark="*">
                    <Rich text={n} />
                  </Row>
                </div>
              ))}
            </>
          ),
          space: px(LEVEL.circ.before),
        });
      });
      // 이 나라 근거: 법령·문서 조항 (각주)
      const nums = [...new Set([...d.sourceNumbers, ...d.points.flatMap((p) => p.sourceNumbers)])];
      const refs = nums.map((n) => footnoteOf(answer, n)).filter((x): x is string => !!x);
      if (refs.length > 0)
        blocks.push({
          key: `${k}-d${i}f`,
          node: (
            <>
              {refs.map((r, x) => (
                <div key={x} style={{ paddingTop: x ? `${px(2)}px` : 0 }}>
                  <Row level="note" mark="*">
                    {r}
                  </Row>
                </div>
              ))}
            </>
          ),
          space: px(5),
        });
    });
  }

  // (4) 유의사항
  let no = 4;
  if (item.cautions.length > 0) {
    blocks.push({ key: `${k}-h4`, node: <HeadingB text={`(${no}) 유의사항`} />, space: px(30), keepNext: true });
    item.cautions.forEach((c, i) => {
      blocks.push({
        key: `${k}-c${i}`,
        node: (
          <Row level="sq" mark="□">
            <Rich text={c.lead} tag />
          </Row>
        ),
        space: px(i === 0 ? 14 : LEVEL.sq.before),
        keepNext: c.subs.length > 0,
      });
      c.subs.forEach((s, j) =>
        blocks.push({
          key: `${k}-c${i}s${j}`,
          node: (
            <Row level="circ" mark="ㅇ">
              <Rich text={s} />
            </Row>
          ),
          space: px(LEVEL.circ.before),
        }),
      );
    });
    no++;
  }

  // 참고자료: 이 과제에 쓴 근거 문서 목록
  const docs = new Map<string, string>();
  const used = new Set<number>();
  item.details.forEach((d) => {
    d.sourceNumbers.forEach((n) => used.add(n));
    d.points.forEach((p) => p.sourceNumbers.forEach((n) => used.add(n)));
  });
  answer.sources
    .filter((s) => used.size === 0 || used.has(s.number))
    .forEach((s) => {
      const inst = s.institution.replace(/\s*\([^)]*\)/g, "").split(",")[0].trim();
      docs.set(s.docTitle, `${shortDocTitle(s.docTitle)}(${inst}, ${dateText(s.asOf)})`);
    });
  if (docs.size > 0) {
    blocks.push({ key: `${k}-h5`, node: <HeadingB text={`(${no}) 참고자료`} />, space: px(30), keepNext: true });
    [...docs.values()].forEach((text, i) =>
      blocks.push({
        key: `${k}-r${i}`,
        node: (
          <Row level="sq" mark="□">
            {text}
          </Row>
        ),
        space: px(i === 0 ? 14 : 12),
      }),
    );
  }
  return blocks;
}

// ───────────── 전체 블록 (Ⅰ 검토 개요 → Ⅱ 검토 내용 → Ⅲ 유의사항) ─────────────
function buildBlocks(items: AnsweredItem[], report: ReportData): Block[] {
  const blocks: Block[] = [];
  const num = (i: number, text: ReactNode): Block["node"] => (
    <Row level="num" mark={NUM_MARK[i]}>
      {text}
    </Row>
  );

  // Ⅰ. 검토 개요
  blocks.push({ key: "c1", node: <ChapterTitle no={0} title="검토 개요" />, space: 0, breakBefore: true, tocId: "c1" });
  blocks.push({ key: "c1-h1", node: <HeadingA text="(1) 검토 배경 및 목적" />, space: px(26), keepNext: true });
  blocks.push({
    key: "c1-1",
    node: num(0, <Rich text="(검토 목적) **한국·일본·중국·미국**의 외환제도를 같은 기준(제도 개요·주요 규제·최근 변경)으로 비교·분석하여 외환제도 업무 검토 시 **참고 자료**로 활용" tag />),
    space: px(14),
  });
  blocks.push({ key: "c1-h2", node: <HeadingA text="(2) 검토 방법" />, space: px(28), keepNext: true });
  blocks.push({
    key: "c1-2",
    node: num(0, <Rich text="(근거 자료) 등록된 **법령·기관 자료**에 있는 내용만 정리하고, 문서에 없는 내용은 **해당 자료 없음**으로 표시" tag />),
    space: px(14),
  });
  blocks.push({
    key: "c1-3",
    node: num(1, <Rich text={`(검토 과제) 챗봇 질문 **${items.length}건**을 과제별로 정리`} tag />),
    space: px(16),
    keepNext: true,
  });
  report.items.forEach((it, i) =>
    blocks.push({
      key: `c1-3-${i}`,
      node: (
        <Row level="dot" mark="▪">
          검토과제 {i + 1}: {it.title}
        </Row>
      ),
      space: px(LEVEL.dot.before),
    }),
  );
  blocks.push({
    key: "c1-n",
    node: (
      <Row level="note" mark="*">
        과제별 근거 법령·문서는 각 과제의 세부 내용(각주)과 참고자료에 표시
      </Row>
    ),
    space: px(6),
  });

  // Ⅱ. 검토 내용
  report.items.forEach((it, i) => blocks.push(...itemBlocks(it, items[i].answer, i, i === 0)));

  // Ⅲ. 유의사항
  blocks.push({ key: "c3", node: <ChapterTitle no={2} title="유의사항" />, space: 0, breakBefore: true, tocId: "c3" });
  blocks.push({ key: "c3-h1", node: <HeadingA text="(1) 보고서의 성격" />, space: px(26), keepNext: true });
  blocks.push({
    key: "c3-1",
    node: num(0, <Rich text="(참고용) 이 보고서는 **참고용**이며 **공식 해석이 아님**" tag />),
    space: px(14),
  });
  blocks.push({
    key: "c3-2",
    node: num(1, <Rich text="(작성 방식) 챗봇 답변을 보고서 형식으로 정리한 것으로 **담당자 검토 전** 단계" tag />),
    space: px(16),
  });
  blocks.push({ key: "c3-h2", node: <HeadingA text="(2) 활용 시 유의사항" />, space: px(28), keepNext: true });
  blocks.push({
    key: "c3-3",
    node: num(0, <Rich text="(원문 확인) 중요한 판단에 앞서 **법령 원문**과 소관 기관의 **최신 안내** 확인 필요" tag />),
    space: px(14),
  });
  blocks.push({
    key: "c3-4",
    node: num(1, <Rich text="(범위) 환율 전망, 투자 조언, 법률 자문은 **포함하지 않음**" tag />),
    space: px(16),
  });
  return blocks;
}

// ───────────── 쪽 나누기 ─────────────
function paginate(blocks: Block[], heights: number[]): number[][] {
  const pages: number[][] = [[]];
  let used = 0;
  const startNewPage = () => {
    pages.push([]);
    used = 0;
  };
  blocks.forEach((b, i) => {
    const cur = pages[pages.length - 1];
    if (b.breakBefore && cur.length > 0) startNewPage();
    let need = (pages[pages.length - 1].length === 0 ? 0 : b.space) + heights[i];
    if (b.keepNext && blocks[i + 1]) need += blocks[i + 1].space + heights[i + 1];
    if (pages[pages.length - 1].length > 0 && used + need > CONTENT_HEIGHT) startNewPage();
    const page = pages[pages.length - 1];
    used += (page.length === 0 ? 0 : b.space) + heights[i];
    page.push(i);
  });
  return pages;
}

// ───────────── 쪽 틀: A4, 위 26mm, 좌우 20mm, 아래 가운데 쪽 번호 ─────────────
function Page({ children, number, className = "" }: { children: ReactNode; number?: number; className?: string }) {
  return (
    <section className={`rpt-page relative bg-white ${className}`}>
      {children}
      {number !== undefined && (
        <div className="rpt-num absolute right-0 bottom-[13mm] left-0 text-center text-[10pt]">- {number} -</div>
      )}
    </section>
  );
}

// 표지 (샘플 1쪽): 파란 선 2개 사이에 제목·부제, 아래에 날짜, 맨 아래 로고와 기관 이름
function Cover({ subtitle, date, logo }: { subtitle: string; date: string; logo: string | null }) {
  const bar: CSSProperties = { height: "4px", background: "#6699ff" };
  return (
    <Page>
      <div className="absolute right-[14.6%] left-[14.6%]" style={{ top: "158pt" }}>
        <div style={bar} />
        <div className="py-[24pt] text-center">
          <div className="rpt-head whitespace-nowrap text-[29pt] leading-[1.3]">주요 국가 외환제도 비교 검토</div>
          <div className="rpt-head text-[24pt] leading-[1.3]">({subtitle})</div>
        </div>
        <div style={bar} />
      </div>
      <div className="rpt-body absolute right-0 left-0 text-center text-[24pt] font-bold" style={{ top: "415pt" }}>
        {date}
      </div>
      <div className="absolute right-0 left-0 flex items-center justify-center gap-[10pt]" style={{ top: "676pt" }}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" style={{ height: "34pt", width: "auto" }} />
        )}
        <span className="rpt-head text-[27pt] tracking-[0.12em]">재정경제부</span>
        <span className="rpt-head ml-[2pt] text-[16pt]">외환제도과</span>
      </div>
    </Page>
  );
}

// 목차 (샘플 3쪽): 둥근 테두리, "목 차" 제목, 점선과 쪽 번호
function Toc({ entries }: { entries: { level: 0 | 1; no: string; text: string; page: number }[] }) {
  return (
    <Page>
      <div
        className="absolute border-[2px] border-black"
        style={{ left: "53pt", right: "78pt", top: "71pt", bottom: "75pt", borderRadius: "16pt", padding: "20pt 26pt" }}
      >
        <div className="mb-[38pt] flex items-center justify-center gap-[14pt]">
          <span className="grid h-[22pt] w-[22pt] grid-cols-2 gap-[1.5px]" aria-hidden="true">
            {["#555", "#999", "#999", "#555"].map((c, i) => (
              <i key={i} style={{ background: c }} />
            ))}
          </span>
          <span className="rpt-head bg-[#e0ffff] px-[22pt] py-[1pt] text-[25pt] tracking-[0.2em]">목 차</span>
          <span className="grid h-[22pt] w-[22pt] grid-cols-2 gap-[1.5px]" aria-hidden="true">
            {["#555", "#999", "#999", "#555"].map((c, i) => (
              <i key={i} style={{ background: c }} />
            ))}
          </span>
        </div>
        {entries.map((e, i) => (
          <div
            key={i}
            className={`flex items-end ${e.level === 0 ? "rpt-head text-[18pt]" : "rpt-head ml-[16pt] text-[16pt]"}`}
            style={{ marginTop: e.level === 0 ? (i === 0 ? 0 : "40pt") : "13pt" }}
          >
            <span className="whitespace-nowrap">
              {e.level === 0 ? (
                <>
                  <span className="rpt-body">{e.no}</span>. {e.text}
                </>
              ) : (
                <>
                  {e.no}. {e.text}
                </>
              )}
            </span>
            <span className="mx-[6pt] mb-[5pt] flex-1 border-b-[1.5px] border-dotted border-black" />
            <span className="whitespace-nowrap">{e.page}</span>
          </div>
        ))}
      </div>
    </Page>
  );
}

// ───────────── 보고서 전체 ─────────────
export default function ReportView({
  items,
  report,
  date,
  preview = false,
  onReady,
}: {
  items: AnsweredItem[];
  report: ReportData | null;
  date: string;
  // true면 화면에서도 종이 모양으로 보이고, false면 인쇄할 때만 보인다
  preview?: boolean;
  // 쪽 나누기가 끝나 인쇄할 수 있게 되면 한 번 불린다
  onReady?: () => void;
}) {
  const valid = !!report && report.items.length === items.length && report.items.every((it) => Array.isArray(it.directions));
  const blocks = useMemo(() => (valid && report ? buildBlocks(items, report) : []), [valid, items, report]);
  const signature = useMemo(() => JSON.stringify(report) + date, [report, date]);

  const measureRef = useRef<HTMLDivElement>(null);
  const [paged, setPaged] = useState<{ signature: string; pages: number[][]; tocPage: Record<string, number> } | null>(null);
  const ready = paged?.signature === signature;

  // 블록 높이를 재서 쪽을 나눈다.
  useLayoutEffect(() => {
    if (!valid || ready || !measureRef.current) return;
    const heights = [...measureRef.current.children].map((el) => (el as HTMLElement).offsetHeight);
    if (heights.length !== blocks.length) return;
    const pages = paginate(blocks, heights);
    const tocPage: Record<string, number> = {};
    pages.forEach((page, p) => page.forEach((i) => {
      const id = blocks[i].tocId;
      if (id && tocPage[id] === undefined) tocPage[id] = p + 1; // 쪽 번호는 Ⅰ이 있는 쪽부터 1
    }));
    setPaged({ signature, pages, tocPage });
  }, [valid, ready, blocks, signature]);

  // 쪽 나누기가 끝난 순간 한 번만 알린다 (onReady 함수가 바뀌어도 다시 알리지 않는다)
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  });
  useEffect(() => {
    if (ready) onReadyRef.current?.();
  }, [ready]);

  // 지난 보고서 미리보기는 화면 너비에 맞춰 줄여서 보여 준다 (인쇄할 때는 원래 크기)
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!preview || !ready || !wrapRef.current) return;
    const el = wrapRef.current;
    const update = () => setZoom(Math.min(1, el.clientWidth / PAGE_WIDTH_PX));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [preview, ready]);

  if (!valid || !report) return null;

  const logo = "/gov-logo.png";
  const subtitle = report.items.length > 1 ? `${report.items[0].title} 외 ${report.items.length - 1}건` : report.items[0].title;
  const coverDate = date.replace(/\.$/, "");

  const tocEntries = ready
    ? [
        { level: 0 as const, no: "Ⅰ", text: "검토 개요", page: paged.tocPage.c1 ?? 1 },
        { level: 0 as const, no: "Ⅱ", text: "검토 내용", page: paged.tocPage.c2 ?? 1 },
        ...report.items.map((it, i) => ({ level: 1 as const, no: String(i + 1), text: `검토과제 ${i + 1}  ${it.title}`, page: paged.tocPage[`t${i}`] ?? 1 })),
        { level: 0 as const, no: "Ⅲ", text: "유의사항", page: paged.tocPage.c3 ?? 1 },
      ]
    : [];

  const rootClass = preview
    ? "rpt-root block"
    : "rpt-root pointer-events-none absolute top-0 -left-[99999px] print:pointer-events-auto print:static";

  return (
    <div className={rootClass} aria-hidden={preview ? undefined : "true"}>
      {/* 쪽 나누기 전: 블록 높이를 재기 위해 한 번만 그린다 (화면 밖) */}
      {!ready && (
        <div
          ref={measureRef}
          className="absolute top-0 -left-[99999px]"
          style={{ width: `${PAGE_WIDTH_PX - 40 * MM}px`, visibility: "hidden" }}
        >
          {blocks.map((b) => (
            <div key={b.key}>{b.node}</div>
          ))}
        </div>
      )}

      {ready && (
        <div ref={wrapRef} className="rpt-zoomwrap">
          <div className="rpt-pages" style={preview ? { zoom } : undefined}>
            <Cover subtitle={subtitle} date={coverDate} logo={logo} />
            <Toc entries={tocEntries} />
            {paged.pages.map((page, p) => (
              <Page key={p} number={p + 1} className="rpt-content">
                {page.map((i, n) => (
                  <div key={blocks[i].key} style={{ paddingTop: n === 0 ? 0 : `${blocks[i].space}px` }}>
                    {blocks[i].node}
                  </div>
                ))}
              </Page>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
