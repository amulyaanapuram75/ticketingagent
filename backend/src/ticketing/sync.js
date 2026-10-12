import cron from 'node-cron';
import { ticketingFetch } from './client.js';
import { normalizeTicket } from './mapping.js';
import { config } from '../config.js';
import { upsertTicket, saveEmbedding, setMeta, getMeta, getTicketCount } from '../db/index.js';
import { embedTexts, buildTicketText } from '../openai/client.js';

const syncState = {
  running: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  lastSummary: null,
  lastProgress: null,
};

export function getSyncState() {
  return {
    ...syncState,
    totalTickets: getTicketCount(),
    nextScheduled: nextCronRun(),
    intervalHours: config.sync.intervalHours,
  };
}

function nextCronRun() {
  const h = Math.max(1, config.sync.intervalHours);
  const now = new Date();
  const next = new Date(now.getTime() + h * 3600 * 1000);
  return next.toISOString();
}

function extractList(body) {
  if (Array.isArray(body)) return body;
  for (const key of ['issues', 'data', 'tickets', 'results', 'items', 'rows', 'records']) {
    if (Array.isArray(body?.[key])) return body[key];
    if (Array.isArray(body?.[key]?.items)) return body[key].items;
  }
  return [];
}

function totalPagesFrom(body, listLen) {
  if (typeof body?.totalPages === 'number') return body.totalPages;
  if (typeof body?.total === 'number' && listLen > 0) return Math.ceil(body.total / listLen);
  return null;
}

async function fetchAllTickets(onPage) {
  const endpoint = config.ticketing.listEndpoint || '/api/tickets';
  const all = [];
  let page = 1;
  const cap = config.sync.maxTickets;
  const hardSafety = 2000;
  let totalPages = null;

  while (page <= hardSafety) {
    const { body } = await ticketingFetch(endpoint, {
      params: { page, per_page: config.sync.pageSize, limit: config.sync.pageSize, pageSize: config.sync.pageSize },
    });
    const list = extractList(body);
    if (!list.length) break;
    all.push(...list);
    if (totalPages === null) totalPages = totalPagesFrom(body, list.length);
    onPage?.({ page, got: list.length, total: all.length, totalPages, totalReported: body?.total });
    if (cap && all.length >= cap) {
      all.length = cap;
      break;
    }
    if (totalPages && page >= totalPages) break;
    if (list.length < config.sync.pageSize && !totalPages) break;
    page += 1;
  }
  return all;
}

export async function runSyncOnce() {
  if (syncState.running) {
    return { skipped: true, reason: 'already running' };
  }
  syncState.running = true;
  syncState.lastStartedAt = new Date().toISOString();
  syncState.lastError = null;
  console.log('[sync] starting pull from ticketing API…');
  try {
    const raw = await fetchAllTickets(({ page, total, totalPages, totalReported }) => {
      const pageLabel = totalPages ? `${page}/${totalPages}` : `${page}`;
      const reported = totalReported ? ` (api total: ${totalReported})` : '';
      console.log(`[sync] fetched page ${pageLabel} — ${total} tickets so far${reported}`);
      syncState.lastProgress = { phase: 'fetch', page, totalPages, totalFetched: total, totalReported };
    });
    console.log(`[sync] fetched ${raw.length} raw tickets`);
    const normalized = raw.map(normalizeTicket).filter((t) => t && t.id);

    const changedIds = [];
    const changedTexts = [];
    const changedRowids = [];

    for (const t of normalized) {
      const { rowid, changed } = upsertTicket(t);
      if (changed) {
        changedIds.push(t.id);
        changedTexts.push(buildTicketText(t));
        changedRowids.push(rowid);
      }
    }

    console.log(`[sync] ${changedIds.length} tickets changed; embedding…`);

    // Batch embeddings to stay within OpenAI limits.
    const BATCH = 64;
    for (let i = 0; i < changedTexts.length; i += BATCH) {
      const slice = changedTexts.slice(i, i + BATCH);
      const vectors = await embedTexts(slice);
      for (let j = 0; j < vectors.length; j++) {
        saveEmbedding(changedRowids[i + j], vectors[j]);
      }
      const done = Math.min(i + BATCH, changedTexts.length);
      console.log(`[sync] embedded ${done}/${changedTexts.length}`);
      syncState.lastProgress = { phase: 'embed', embedded: done, total: changedTexts.length };
    }

    syncState.lastSummary = {
      fetched: raw.length,
      normalized: normalized.length,
      changed: changedIds.length,
      total: getTicketCount(),
    };
    setMeta('last_sync_at', new Date().toISOString());
    console.log('[sync] done', syncState.lastSummary);
    return syncState.lastSummary;
  } catch (err) {
    syncState.lastError = err.message;
    console.error('[sync] failed:', err.message);
    throw err;
  } finally {
    syncState.lastFinishedAt = new Date().toISOString();
    syncState.running = false;
  }
}

let scheduled = null;
export function startScheduler() {
  if (scheduled) return;
  const hours = Math.max(1, config.sync.intervalHours);
  const expr = `0 */${hours} * * *`;
  scheduled = cron.schedule(expr, () => {
    runSyncOnce().catch((err) => console.error('[sync] scheduled run failed:', err.message));
  });
  console.log(`[sync] scheduler armed: every ${hours}h (cron "${expr}")`);
}

export function lastSyncAt() {
  return getMeta('last_sync_at');
}
