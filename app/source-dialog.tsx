"use client";

import { useRef } from "react";

// 왼쪽 하단 "제도 내용 출처 보기" 버튼과, 누르면 뜨는 작은 창.
// 목록이 길어서 평소에는 버튼 하나만 보이게 한다. 내용은 서버(page.tsx)가 저장된 근거 문서 정보로 채워 준다.

export type SourceGroup = {
  label: string; // 나라 이름
  docs: { id: string; title: string; institution: string; asOf: string; sourceUrl: string }[];
};

export default function SourceDialog({ groups }: { groups: SourceGroup[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="w-fit rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-semibold text-brand-strong transition-colors hover:bg-blue-100"
      >
        제도 내용 출처 보기
      </button>

      {/* 창 바깥(어두운 부분)을 누르거나 Esc를 누르면 닫힌다 */}
      <dialog
        ref={dialogRef}
        aria-label="제도 내용 출처"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto max-h-[80dvh] w-[min(92vw,34rem)] overflow-y-auto rounded-3xl bg-white p-0 text-foreground shadow-[0_20px_60px_rgba(25,31,40,0.25)] backdrop:bg-black/30"
      >
        <div className="p-5 md:p-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">제도 내용 출처 (한·중·일·미)</h2>
              <p className="mt-0.5 text-xs text-muted">답변의 근거로 저장해 둔 문서 목록이에요.</p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="shrink-0 rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted transition-colors hover:bg-brand-soft"
            >
              닫기
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <section key={group.label}>
                <h3 className="mb-1 text-sm font-bold text-brand-strong">{group.label}</h3>
                <ul className="flex flex-col gap-1.5">
                  {group.docs.map((doc) => (
                    <li key={doc.id} className="rounded-xl bg-background px-3 py-2 text-xs leading-relaxed">
                      <span className="font-semibold">{doc.title}</span>
                      <span className="block text-muted">
                        {doc.institution} · 기준일 {doc.asOf}
                        {doc.sourceUrl.startsWith("http") && (
                          <>
                            {" · "}
                            <a
                              href={doc.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand underline"
                            >
                              원문
                            </a>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
