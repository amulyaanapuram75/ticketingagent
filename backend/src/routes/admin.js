import { Router } from 'express';
import { runSyncOnce, getSyncState } from '../ticketing/sync.js';

export const adminRouter = Router();

adminRouter.get('/sync/status', (_req, res) => {
  res.json(getSyncState());
});

adminRouter.post('/sync/run', async (_req, res) => {
  if (getSyncState().running) {
    return res.status(409).json({ error: 'sync already running', state: getSyncState() });
  }
  res.json({ started: true, state: getSyncState() });
  runSyncOnce().catch((err) => console.error('[admin] sync failed:', err.message));
});
