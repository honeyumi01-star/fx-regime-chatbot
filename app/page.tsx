import { getSuggestions } from "@/lib/search";
import fs from "node:fs";
import path from "node:path";
import ChatPanel from "./chat-panel";

// 기관 로고 파일: public 폴더에 gov-logo.png / .svg / .jpg 중 하나를 넣으면 제목 위에 나온다 (없으면 이름만 표시)
function findLogo(): string | null {
  for (const name of ["gov-logo.svg", "gov-logo.png", "gov-logo.jpg"]) {
    if (fs.existsSync(path.join(process.cwd(), "public", name))) return `/${name}`;
  }
  return null;
}

// Design Ref: §2 화면 구성 — 왼쪽: ① 제목 + ② 안내 문구 / 오른쪽: ③ 대화 영역과 ④ 입력창
export default async function Home() {
  // 처음 화면의 키워드 예시는 용어 사전의 대표 표현에서 서버가 고른다
  const suggestions = await getSuggestions();
  const logo = findLogo();

  return (
    <main className="mx-auto grid min-h-dvh print:block print:h-auto w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 md:h-dvh md:grid-cols-[19rem_minmax(0,1fr)] md:gap-8 md:px-8 md:py-10">
      {/* 왼쪽: 제목과 안내 문구 */}
      <aside className="flex flex-col gap-6 print:hidden md:pt-6">
        {/* 왼쪽 맨 위: 기관 로고와 기관 이름 */}
        <div className="flex items-center gap-3">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-9 w-auto" />
          )}
          <span className="text-lg font-bold tracking-tight text-foreground">재정경제부</span>
        </div>
        <div className="flex flex-col gap-3">
          <span className="w-fit rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-strong">
            한국 · 일본 · 중국
          </span>
          {/* 앱 이름: 화면에서 가장 큰 제목 */}
          <h1 className="text-4xl leading-tight font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            한중일
            <br />
            <span className="text-brand">외환제도</span> 분석
            <br />
            챗봇
          </h1>
          <p className="text-base leading-relaxed text-muted">
            궁금한 키워드를 입력하면 세 나라의 제도를 같은 기준의 표로 비교하고, 칸마다 근거 문서를 붙여 드려요.
          </p>
        </div>
        {/* ② 안내 문구: 항상 보인다 (DESIGN §2, PRD §7) */}
        <p className="rounded-2xl bg-brand-soft px-5 py-4 text-sm leading-relaxed text-brand-strong">
          ⚠ 답변은 참고용이며 공식 해석이 아닙니다. 개인정보는 입력하지 마세요. 질문 내용은 답변을 만들기 위해
          OpenAI로 전송됩니다.
        </p>
      </aside>

      {/* 오른쪽: 대화 영역과 입력창 */}
      <ChatPanel initialSuggestions={suggestions} />
    </main>
  );
}
