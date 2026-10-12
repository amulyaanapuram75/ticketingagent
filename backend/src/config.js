import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

function optional(name, fallback = '') {
  const v = process.env[name];
  return v ? v.trim() : fallback;
}

export const config = {
  port: Number(optional('PORT', '5174')),
  openai: {
    apiKey: required('OPENAI_API_KEY'),
    chatModel: optional('OPENAI_CHAT_MODEL', 'gpt-4o-mini'),
    embeddingModel: optional('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
    embeddingDim: 1536,
  },
  ticketing: {
    baseUrl: required('TICKETING_BASE_URL').replace(/\/+$/, ''),
    apiKey: required('TICKETING_API_KEY'),
    authStyle: optional('TICKETING_AUTH_STYLE'),
    listEndpoint: optional('TICKETING_LIST_ENDPOINT'),
    detailEndpoint: optional('TICKETING_DETAIL_ENDPOINT'),
  },
  sync: {
    intervalHours: Number(optional('SYNC_INTERVAL_HOURS', '6')),
    pageSize: Number(optional('SYNC_PAGE_SIZE', '100')),
    onStartup: optional('SYNC_ON_STARTUP', 'true') === 'true',
    maxTickets: optional('SYNC_MAX_TICKETS') ? Number(optional('SYNC_MAX_TICKETS')) : null,
  },
  dataDir: path.resolve(__dirname, '../data'),
};
