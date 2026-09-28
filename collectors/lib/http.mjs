const UA =
  'Mozilla/5.0 (compatible; eduinfo-bot/0.1; admissions news aggregator)';

// 호스트마다 동시 요청 수를 제한하고 요청 사이에 간격을 둔다(서버 부담·차단 방지).
// 기본은 한 번에 하나씩 400ms 간격. 트래픽 한도로 관리되는 공식 Open API는 더 빠르게.
const HOST_LIMITS = {
  default: { concurrency: 1, gap: 400 },
  'apis.data.go.kr': { concurrency: 4, gap: 50 },
  'open.neis.go.kr': { concurrency: 1, gap: 100 },
};
const hosts = new Map();

export function fetchText(url, opts) {
  const host = new URL(url).host;
  const { concurrency, gap } = HOST_LIMITS[host] ?? HOST_LIMITS.default;
  const h = hosts.get(host) ?? hosts.set(host, { active: 0, waiting: [] }).get(host);
  return new Promise((resolve, reject) => {
    const run = () => {
      h.active++;
      doFetch(url, opts)
        .then(resolve, reject)
        .finally(() =>
          setTimeout(() => {
            h.active--;
            h.waiting.shift()?.();
          }, gap),
        );
    };
    h.active < concurrency ? run() : h.waiting.push(run);
  });
}

async function doFetch(url, { timeout = 20000, retries = 2, init = {} } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        ...init,
        headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', ...(init.headers ?? {}) },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export async function fetchJson(url, opts) {
  return JSON.parse(await fetchText(url, opts));
}
