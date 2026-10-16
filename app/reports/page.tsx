import { Suspense } from "react";
import ReportsView from "./reports-view";

// 지난 PDF 보고서 전체 목록 화면 (/reports)
export const metadata = { title: "지난 PDF 보고서 · 한중일 외환제도 분석 챗봇" };

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsView />
    </Suspense>
  );
}
