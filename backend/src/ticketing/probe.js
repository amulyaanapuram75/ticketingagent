import { ticketingFetch, AUTH_STYLES } from './client.js';

const CANDIDATE_LIST_PATHS = [
  '/api/tickets',
  '/api/v1/tickets',
  '/api/v2/tickets',
  '/tickets',
  '/api/ticket',
  '/api/issues',
  '/api/support/tickets',
  '/dashboard/api/tickets',
];

const PROBE_PARAMS = { limit: 1, page: 1, per_page: 1, pageSize: 1 };

function looksLikeTicketList(body) {
  if (!body) return false;
  if (Array.isArray(body) && body.length) return true;
  if (typeof body !== 'object') return false;
  const candidateArrays = ['data', 'tickets', 'results', 'items', 'rows', 'records'];
  for (const key of candidateArrays) {
    if (Array.isArray(body[key])) return true;
    if (body[key] && Array.isArray(body[key].items)) return true;
  }
  return false;
}

function extractSample(body) {
  if (Array.isArray(body)) return body[0];
  for (const key of ['data', 'tickets', 'results', 'items', 'rows', 'records']) {
    if (Array.isArray(body?.[key])) return body[key][0];
    if (Array.isArray(body?.[key]?.items)) return body[key].items[0];
  }
  return null;
}

export async function probeTicketingApi({ log = console.log } = {}) {
  const attempts = [];
  for (const style of AUTH_STYLES) {
    for (const path of CANDIDATE_LIST_PATHS) {
      try {
        log(`[probe] trying ${style.padEnd(10)} ${path}`);
        const { body, url, status } = await ticketingFetch(path, { params: PROBE_PARAMS, style });
        if (looksLikeTicketList(body)) {
          const sample = extractSample(body);
          attempts.push({ ok: true, style, path, url, status, sample, body });
          return { success: true, style, listEndpoint: path, sample, attempts, body };
        }
        attempts.push({ ok: false, style, path, url, status, reason: 'response did not look like a ticket list', snippet: JSON.stringify(body).slice(0, 200) });
      } catch (err) {
        attempts.push({ ok: false, style, path, reason: err.message });
      }
    }
  }
  return { success: false, attempts };
}

export function inferFieldMap(sample) {
  if (!sample || typeof sample !== 'object') return {};
  const keys = Object.keys(sample);
  const findKey = (candidates) => {
    for (const c of candidates) {
      const hit = keys.find((k) => k.toLowerCase() === c.toLowerCase());
      if (hit) return hit;
    }
    for (const c of candidates) {
      const hit = keys.find((k) => k.toLowerCase().includes(c.toLowerCase()));
      if (hit) return hit;
    }
    return null;
  };
  return {
    id: findKey(['id', 'ticket_id', 'ticketId', '_id', 'uuid']),
    number: findKey(['number', 'ticket_number', 'ticketNo', 'key', 'code', 'ref']),
    subject: findKey(['subject', 'title', 'heading', 'summary', 'name']),
    description: findKey(['description', 'body', 'details', 'issue']),
    fixDescription: findKey(['fix_description', 'fixDescription', 'resolution', 'fix', 'solution']),
    rca: findKey(['root_cause', 'rca', 'rootCause', 'cause']),
    status: findKey(['status', 'state']),
    comments: findKey(['comments', 'notes', 'activity', 'replies', 'conversation']),
    updatedAt: findKey(['updated_at', 'updatedAt', 'modified', 'last_updated']),
    createdAt: findKey(['created_at', 'createdAt', 'created']),
    url: findKey(['url', 'link', 'permalink']),
  };
}
