"use client";

// 지난 PDF 보고서 보관함: 이 브라우저(localStorage)에만 저장한다. 서버에는 보내거나 저장하지 않는다.
// 최근 20개까지만 남기고, 브라우저 저장이 막혀 있으면 조용히 건너뛴다(보고서 만들기는 그대로 동작).

import { useSyncExternalStore } from "react";
import type { ReportData } from "./chat-types";
import type { AnsweredItem } from "./report-view";

export type SavedReport = {
  id: string;
  createdAt: number; // 저장한 시각 (밀리초)
  date: string; // 표지에 적힌 날짜 (예: 2026. 10.)
  items: AnsweredItem[];
  data: ReportData;
};

const KEY = "fx-reports-v1";
const EVENT = "fx-reports-changed";
const MAX_REPORTS = 20;
const EMPTY: SavedReport[] = [];

// useSyncExternalStore가 같은 값을 같은 객체로 받도록, 저장된 글자가 같으면 이전 결과를 다시 쓴다
let cachedRaw: string | null = null;
let cachedList: SavedReport[] = EMPTY;

function readList(): SavedReport[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as SavedReport[]) : EMPTY;
    cachedList = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function writeList(list: SavedReport[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 저장 공간이 없거나 막혀 있으면 보관만 못 한다
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addReport(report: SavedReport) {
  writeList([report, ...readList()].slice(0, MAX_REPORTS));
}

export function deleteReport(id: string) {
  writeList(readList().filter((r) => r.id !== id));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // 다른 탭에서 바뀐 경우
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// 저장된 보고서 목록 (최신순). 서버에서 그릴 때는 빈 목록이다.
export function useReports(): SavedReport[] {
  return useSyncExternalStore(subscribe, readList, () => EMPTY);
}

// 목록에 보여 줄 보고서 이름: 첫 과제 이름 (+ 외 n건)
export function reportName(report: SavedReport): string {
  const first = report.data.items[0]?.title ?? "외환제도 비교 검토";
  return report.data.items.length > 1 ? `${first} 외 ${report.data.items.length - 1}건` : first;
}

export function formatSavedAt(createdAt: number): string {
  const d = new Date(createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 인쇄 창을 띄운다. 인쇄 창이 PDF 파일 이름으로 쓰는 탭 제목을 잠깐 바꿨다가 되돌린다.
export function printReport(createdAt: number) {
  const d = new Date(createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const originalTitle = document.title;
  document.title = `외환제도_비교_검토보고서_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  window.addEventListener("afterprint", () => (document.title = originalTitle), { once: true });
  window.print();
}
