import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';

let db;
// In-memory cache of embeddings for fast cosine similarity.
// Shape: Map<ticketRowid, { vec: Float32Array, norm: number }>
const vectorCache = new Map();

export function initDb() {
  if (db) return db;
  const file = path.join(config.dataDir, 'tickets.db');
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      number TEXT,
      cf_key TEXT,
      subject TEXT,
      description TEXT,
      fix_description TEXT,
      rca TEXT,
      ai_fix_description TEXT,
      ai_rca TEXT,
      status TEXT,
      priority TEXT,
      type TEXT,
      product_type TEXT,
      combination TEXT,
      customer_name TEXT,
      comments TEXT,
      updated_at TEXT,
      url TEXT,
      content_hash TEXT,
      raw_json TEXT,
      indexed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ticket_embeddings (
      ticket_rowid INTEGER PRIMARY KEY,
      embedding BLOB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Warm the vector cache from disk.
  const rows = db.prepare('SELECT ticket_rowid, embedding FROM ticket_embeddings').all();
  for (const r of rows) {
    const vec = bufferToFloat32(r.embedding);
    vectorCache.set(Number(r.ticket_rowid), { vec, norm: l2norm(vec) });
  }
  console.log(`[db] loaded ${vectorCache.size} embeddings into memory`);

  return db;
}

function bufferToFloat32(buf) {
  // node:sqlite returns BLOBs as Uint8Array
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return new Float32Array(u8.buffer, u8.byteOffset, u8.byteLength / 4);
}

function float32ToBuffer(arr) {
  const f32 = arr instanceof Float32Array ? arr : new Float32Array(arr);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

function l2norm(vec) {
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i];
  return Math.sqrt(s) || 1;
}

function dot(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function getDb() {
  if (!db) initDb();
  return db;
}

export function hashContent(parts) {
  const h = crypto.createHash('sha256');
  for (const p of parts) h.update(String(p ?? ''));
  h.update(String(config.openai.embeddingModel));
  return h.digest('hex');
}

export function upsertTicket(t) {
  const d = getDb();
  const hash = hashContent([
    t.subject, t.description, t.fixDescription, t.rca,
    t.aiFixDescription, t.aiRca, t.comments, t.status,
    t.priority, t.productType, t.combination, t.customerName,
  ]);
  const existing = d.prepare('SELECT rowid, content_hash FROM tickets WHERE id = ?').get(t.id);
  const now = new Date().toISOString();
  const rawJson = JSON.stringify(t.raw ?? null);

  if (existing && existing.content_hash === hash) {
    return { rowid: Number(existing.rowid), changed: false, hash };
  }

  if (existing) {
    d.prepare(`
      UPDATE tickets SET
        number=?, cf_key=?, subject=?, description=?, fix_description=?, rca=?,
        ai_fix_description=?, ai_rca=?, status=?, priority=?, type=?,
        product_type=?, combination=?, customer_name=?,
        comments=?, updated_at=?, url=?, content_hash=?, raw_json=?, indexed_at=?
      WHERE id=?
    `).run(
      t.number, t.cfKey, t.subject, t.description, t.fixDescription, t.rca,
      t.aiFixDescription, t.aiRca, t.status, t.priority, t.type,
      t.productType, t.combination, t.customerName,
      t.comments, t.updatedAt, t.url, hash, rawJson, now, t.id,
    );
    return { rowid: Number(existing.rowid), changed: true, hash };
  }

  const info = d.prepare(`
    INSERT INTO tickets (
      id, number, cf_key, subject, description, fix_description, rca,
      ai_fix_description, ai_rca, status, priority, type,
      product_type, combination, customer_name,
      comments, updated_at, url, content_hash, raw_json, indexed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    t.id, t.number, t.cfKey, t.subject, t.description, t.fixDescription, t.rca,
    t.aiFixDescription, t.aiRca, t.status, t.priority, t.type,
    t.productType, t.combination, t.customerName,
    t.comments, t.updatedAt, t.url, hash, rawJson, now,
  );
  return { rowid: Number(info.lastInsertRowid), changed: true, hash };
}

export function saveEmbedding(rowid, embedding) {
  const d = getDb();
  const f32 = new Float32Array(embedding);
  const buf = float32ToBuffer(f32);
  d.prepare('DELETE FROM ticket_embeddings WHERE ticket_rowid = ?').run(rowid);
  d.prepare('INSERT INTO ticket_embeddings (ticket_rowid, embedding) VALUES (?, ?)').run(rowid, buf);
  vectorCache.set(Number(rowid), { vec: f32, norm: l2norm(f32) });
}

export function searchSimilar(queryEmbedding, limit = 8) {
  const d = getDb();
  const q = new Float32Array(queryEmbedding);
  const qnorm = l2norm(q);

  const scored = [];
  for (const [rowid, { vec, norm }] of vectorCache) {
    const sim = dot(q, vec) / (qnorm * norm);
    scored.push({ rowid, sim });
  }
  scored.sort((a, b) => b.sim - a.sim);
  const top = scored.slice(0, limit);
  if (!top.length) return [];

  const rowids = top.map((s) => s.rowid);
  const placeholders = rowids.map(() => '?').join(',');
  const rows = d.prepare(`SELECT rowid, * FROM tickets WHERE rowid IN (${placeholders})`).all(...rowids);
  const byRowid = new Map(rows.map((r) => [Number(r.rowid), r]));
  return top.map(({ rowid, sim }) => {
    const row = byRowid.get(rowid);
    return row ? { ...row, distance: 1 - sim, similarity: sim } : null;
  }).filter(Boolean);
}

export function getTicketCount() {
  const d = getDb();
  return Number(d.prepare('SELECT COUNT(*) AS n FROM tickets').get().n);
}

export function getMeta(key) {
  const d = getDb();
  return d.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value || null;
}

export function setMeta(key, value) {
  const d = getDb();
  d.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function listTicketsByIds(ids) {
  if (!ids?.length) return [];
  const d = getDb();
  const placeholders = ids.map(() => '?').join(',');
  return d.prepare(`SELECT * FROM tickets WHERE id IN (${placeholders}) OR number IN (${placeholders})`).all(...ids, ...ids);
}
