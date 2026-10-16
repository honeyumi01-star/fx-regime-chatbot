"use client";

import Link from "next/link";
import { formatSavedAt, reportName, useReports } from "./report-store";

// 챗봇 오른쪽 1/3: 지난 PDF 보고서 목록 (최근 5개)와 전체 목록 버튼
export default function ReportHistory() {
  const reports = useReports();
  const recent = reports.slice(0, 5);

  return (
    <aside
      aria-label="지난 보고서"
      className="flex max-h-80 min-h-0 flex-col rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(25,31,40,0.06)] print:hidden md:p-5 xl:max-h-none"
    >
      <h2 className="text-base font-bold text-foreground">지난 PDF 보고서</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">이 브라우저에만 저장돼요. 서버에는 저장하지 않아요.</p>

      <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {recent.length === 0 ? (
          <li className="rounded-2xl bg-background px-4 py-6 text-center text-sm text-muted">
            아직 저장한 보고서가 없어요.
            <br />
            답변 후 &quot;PDF로 저장&quot;을 누르면 여기에 쌓여요.
          </li>
        ) : (
          recent.map((report) => (
            <li key={report.id}>
              <Link
                href={`/reports?id=${report.id}`}
                className="block rounded-2xl bg-background px-4 py-3 transition-colors hover:bg-brand-soft"
              >
                <span className="line-clamp-2 text-sm font-semibold text-foreground">{reportName(report)}</span>
                <span className="mt-1 block text-xs text-muted">
                  {formatSavedAt(report.createdAt)} · {report.items.length}건
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>

      <Link
        href="/reports"
        className="mt-4 block rounded-2xl bg-brand px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
      >
        전체 목록 보기{reports.length > 0 ? ` (${reports.length})` : ""}
      </Link>
    </aside>
  );
}
