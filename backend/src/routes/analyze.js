import { Router } from 'express';
import { analyzeTopic } from '../agent/analyze.js';

export const analyzeRouter = Router();

analyzeRouter.post('/', async (req, res) => {
  const { query, topK } = req.body || {};
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query (string) is required' });
  }
  try {
    const result = await analyzeTopic({ query: query.trim(), topK: Number(topK) || 8 });
    res.json(result);
  } catch (err) {
    console.error('[analyze] error:', err);
    res.status(500).json({ error: err.message });
  }
});
