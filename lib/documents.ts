// Design Ref: §4.1 근거 문서 — data/documents/ 폴더의 문서를 읽어 조각으로 나눈다.
// Plan: 작업 2 — 문서를 앱 안에 저장하고 문서명·기관명·기준일 정보를 붙인다.
// 서버 코드에서만 불러온다. 파일 이름이 `_`로 시작하는 것(양식, 후보 목록)은 읽지 않는다.

import fs from "node:fs/promises";
import path from "node:path";
import type { Chunk } from "./ask-ai";

export type DocMeta = {
  id: string;
  country: "KR" | "JP" | "CN";
  title: string;
  institution: string;
  asOf: string;
  sourceUrl: string;
};

// 조각에는 어느 문서에서 왔는지(docId)를 함께 적어 둔다
export type StoredChunk = Chunk & { docId: string };

export type DocumentStore = {
  docs: DocMeta[];
  chunks: StoredChunk[];
};

const DOCUMENTS_DIR = path.join(process.cwd(), "data", "documents");

let cache: Promise<DocumentStore> | null = null;

// 문서는 처음 한 번만 읽고 서버가 켜져 있는 동안 기억해 둔다
export function loadDocuments(): Promise<DocumentStore> {
  cache ??= readAll().catch((error) => {
    cache = null; // 실패하면 다음 요청에서 다시 시도한다
    throw error;
  });
  return cache;
}

async function readAll(): Promise<DocumentStore> {
  const names = (await fs.readdir(DOCUMENTS_DIR)).filter(
    (name) => name.endsWith(".md") && !name.startsWith("_"),
  );

  const docs: DocMeta[] = [];
  const chunks: StoredChunk[] = [];

  for (const name of names.sort()) {
    const raw = await fs.readFile(path.join(DOCUMENTS_DIR, name), "utf8");
    const parsed = parseDocument(raw);
    if (!parsed) {
      console.error(`[documents] 형식이 맞지 않아 건너뜁니다: ${name}`);
      continue;
    }
    docs.push(parsed.meta);
    parsed.sections.forEach((section, index) => {
      chunks.push({
        id: `${parsed.meta.id}#${index + 1}`,
        docId: parsed.meta.id,
        country: parsed.meta.country,
        heading: section.heading,
        text: section.text,
      });
    });
  }
  return { docs, chunks };
}

// 맨 위 `---` 사이의 정보와, 본문의 `## ` 제목별 조각으로 나눈다
export function parseDocument(raw: string) {
  const text = raw.replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }

  const country = fields.country;
  if (!fields.id || (country !== "KR" && country !== "JP" && country !== "CN")) return null;

  const meta: DocMeta = {
    id: fields.id,
    country,
    title: fields.title ?? fields.id,
    institution: fields.institution ?? "",
    asOf: fields.asOf ?? "",
    sourceUrl: fields.sourceUrl ?? "",
  };

  // HTML 주석은 안내용이므로 지운다
  const body = match[2].replace(/<!--[\s\S]*?-->/g, "");
  const sections: { heading: string; text: string }[] = [];
  for (const part of body.split(/^## /m).slice(1)) {
    const newline = part.indexOf("\n");
    const heading = (newline === -1 ? part : part.slice(0, newline)).trim();
    const content = (newline === -1 ? "" : part.slice(newline + 1)).trim();
    if (heading && content) sections.push({ heading, text: content });
  }
  return { meta, sections };
}
