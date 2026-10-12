import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initDb } from './db/index.js';
import { startScheduler, runSyncOnce, getSyncState } from './ticketing/sync.js';
import { analyzeRouter } from './routes/analyze.js';
import { ticketsRouter } from './routes/tickets.js';
import { adminRouter } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!fs.existsSync(config.dataDir)) fs.mkdirSync(config.dataDir, { recursive: true });

initDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, sync: getSyncState() });
});

app.use('/api/analyze', analyzeRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/admin', adminRouter);

// In prod, serve the built React frontend from the backend.
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  console.log(`[server] serving frontend from ${frontendDist}`);
}

app.listen(config.port, '0.0.0.0', () => {
  console.log(`[server] listening on port ${config.port}`);
});

startScheduler();

if (config.sync.onStartup) {
  runSyncOnce().catch((err) => console.error('[sync] startup sync failed:', err.message));
}
