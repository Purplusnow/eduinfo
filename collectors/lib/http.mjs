const UA =
  'Mozilla/5.0 (compatible; eduinfo-bot/0.1; admissions news aggregator)';

// 같은 호스트로는 한 번에 하나씩, 약간의 간격을 두고 요청한다(서버 부담·차단 방지).
const hostQueues = new Map();
const HOST_GAP_MS = 400;

export function fetchText(url, opts) {
  const host = new URL(url).host;
  const prev = hostQueues.get(host) ?? Promise.resolve();
  const job = prev.then(() => doFetch(url, opts)).finally(() => new Promise((r) => setTimeout(r, HOST_GAP_MS)));
  hostQueues.set(host, job.catch(() => {}));
  return job;
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
