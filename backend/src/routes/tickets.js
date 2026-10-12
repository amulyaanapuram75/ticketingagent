import { Router } from 'express';
import { getDb, listTicketsByIds } from '../db/index.js';
import { htmlToText } from '../util/html.js';

export const ticketsRouter = Router();

function cleanRow(row) {
  if (!row) return row;
  return {
    ...row,
    description: htmlToText(row.description),
    rca: htmlToText(row.rca),
    fix_description: htmlToText(row.fix_description),
    ai_rca: htmlToText(row.ai_rca),
    ai_fix_description: htmlToText(row.ai_fix_description),
    comments: htmlToText(row.comments),
  };
}

ticketsRouter.get('/', (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const q = (req.query.q || '').toString().trim();
  const d = getDb();
  const rows = q
    ? d.prepare(`SELECT id, number, subject, status, updated_at FROM tickets WHERE subject LIKE ? OR description LIKE ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(`%${q}%`, `%${q}%`, limit, offset)
    : d.prepare(`SELECT id, number, subject, status, updated_at FROM tickets ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
  res.json({ tickets: rows });
});

ticketsRouter.get('/by-ids', (req, res) => {
  const ids = (req.query.ids || '').toString().split(',').map((s) => s.trim()).filter(Boolean);
  res.json({ tickets: listTicketsByIds(ids).map(cleanRow) });
});

ticketsRouter.get('/:id', (req, res) => {
  const d = getDb();
  const row = d.prepare('SELECT * FROM tickets WHERE id = ? OR number = ?').get(req.params.id, req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(cleanRow(row));
});
