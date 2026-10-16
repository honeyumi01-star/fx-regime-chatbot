"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ReportView from "../report-view";
import { deleteReport, formatSavedAt, printReport, reportName, useReports } from "../report-store";

// 왼쪽: 저장된 보고서 목록 / 오른쪽: 고른 보고서 미리보기 + PDF로 다시 저장 + 삭제
export default function ReportsView() {
  const reports = useReports();
  const router = useRouter();
  const wantedId = useSearchParams().get("id");

  // 주소의 id가 없거나 목록에 없으면 가장 최근 보고서를 보여 준다
  const selected = reports.find((r) => r.id === wantedId) ?? reports[0] ?? null;

  function remove(id: string) {
    if (!window.confirm("이 보고서를 목록에서 삭제할까요? (이 브라우저의 보관본만 지워져요)")) return;
    deleteReport(id);
    router.replace("/reports");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-6 px-4 py-6 print:block print:p-0 md:px-8 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">지난 PDF 보고서</h1>
          <p className="mt-1 text-sm text-muted">이 브라우저에 저장된 보고서예요. 최근 20개까지 보관해요.</p>
        </div>
        <Link
          href="/"
          className="rounded-2xl bg-brand-soft px-5 py-2.5 text-sm font-semibold text-brand-strong transition-colors hover:bg-blue-100"
        >
          ← 챗봇으로 돌아가기
        </Link>
      </header>

      {reports.length === 0 || !selected ? (
        <p className="rounded-3xl bg-white px-6 py-16 text-center text-muted shadow-[0_8px_30px_rgba(25,31,40,0.06)] print:hidden">
          아직 저장한 보고서가 없어요. 챗봇에서 답변을 받은 뒤 &quot;PDF로 저장&quot;을 눌러 보세요.
        </p>
      ) : (
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] print:block">
          <ul className="flex flex-col gap-2 print:hidden">
            {reports.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/reports?id=${report.id}`}
                  aria-current={report.id === selected.id ? "true" : undefined}
                  className={`block rounded-2xl px-4 py-3 shadow-[0_2px_10px_rgba(25,31,40,0.05)] transition-colors ${
                    report.id === selected.id ? "bg-brand text-white" : "bg-white hover:bg-brand-soft"
                  }`}
                >
                  <span className="line-clamp-2 text-sm font-semibold">{reportName(report)}</span>
                  <span className={`mt-1 block text-xs ${report.id === selected.id ? "text-blue-100" : "text-muted"}`}>
                    {formatSavedAt(report.createdAt)} · {report.items.length}건
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
              <p className="text-sm font-semibold text-foreground">{reportName(selected)}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => printReport(selected.createdAt)}
                  className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
                >
                  PDF로 저장
                </button>
                <button
                  type="button"
                  onClick={() => remove(selected.id)}
                  className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-red-600 shadow-[0_2px_10px_rgba(25,31,40,0.06)] transition-colors hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
            {/* 미리보기: 종이 모양으로 보여 준다. 인쇄할 때는 이 보고서만 나온다 */}
            <div className="overflow-auto rounded-3xl bg-[#e8ecf3] p-3 md:p-6 print:overflow-visible print:bg-transparent print:p-0">
              <ReportView items={selected.items} report={selected.data} date={selected.date} preview />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
