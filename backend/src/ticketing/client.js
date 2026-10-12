import { config } from '../config.js';

const AUTH_STYLES = ['bearer', 'x-api-key', 'api-key', 'query'];

function buildHeaders(style) {
  const h = { Accept: 'application/json' };
  if (style === 'bearer') h.Authorization = `Bearer ${config.ticketing.apiKey}`;
  if (style === 'x-api-key') h['x-api-key'] = config.ticketing.apiKey;
  if (style === 'api-key') h['api-key'] = config.ticketing.apiKey;
  return h;
}

function buildUrl(pathname, style, extraParams = {}) {
  const url = new URL(pathname, config.ticketing.baseUrl + '/');
  for (const [k, v] of Object.entries(extraParams)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  if (style === 'query') url.searchParams.set('api_key', config.ticketing.apiKey);
  return url.toString();
}

export async function ticketingFetch(pathname, { params = {}, style, method = 'GET' } = {}) {
  const styles = style ? [style] : (config.ticketing.authStyle ? [config.ticketing.authStyle] : AUTH_STYLES);
  let lastErr;
  for (const s of styles) {
    const url = buildUrl(pathname, s, params);
    try {
      const res = await fetch(url, { method, headers: buildHeaders(s) });
      if (res.status === 401 || res.status === 403) {
        lastErr = new Error(`auth failed with style=${s} (status ${res.status})`);
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} on ${url}: ${text.slice(0, 300)}`);
      }
      const contentType = res.headers.get('content-type') || '';
      const body = contentType.includes('application/json') ? await res.json() : await res.text();
      return { body, usedStyle: s, url, status: res.status };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('ticketingFetch failed with no attempts');
}

export { AUTH_STYLES };
