// 서버 API들이 함께 쓰는 요청 검사: 호출 횟수 제한(IP별)과 같은 사이트에서 온 요청인지 확인

// 같은 주소(IP)에서 1분에 limit번까지만 허용한다 (비용 폭주 방지, CHECK 3번).
// 서버 한 대의 기억 안에서만 세므로 완전하지 않다. 배포 때 Vercel 방화벽 제한도 함께 켠다.
export function createRateLimiter(limit: number, windowMs = 60_000) {
  const hits = new Map<string, number[]>();
  return function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((time) => now - time < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) {
      // 기억이 너무 커지지 않게 오래된 주소를 지운다
      for (const [key, times] of hits) {
        if (times.every((time) => now - time >= windowMs)) hits.delete(key);
      }
    }
    return recent.length > limit;
  };
}

// 다른 사이트의 페이지가 방문자 브라우저로 이 API를 부르는 것을 막는다
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // 브라우저가 아닌 직접 호출(curl 등)은 Origin이 없다
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
