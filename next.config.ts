import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 근거 문서(data/ 폴더)를 서버에서 파일로 읽으므로, 배포할 때 /api/chat과 첫 화면에 함께 들어가도록 한다
  outputFileTracingIncludes: {
    "/api/chat": ["./data/**/*"],
    "/": ["./data/**/*"],
  },
  // 보안 헤더: 다른 사이트에 끼워 넣기·형식 추측·주소 노출을 막는다 (CHECK 19번)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
