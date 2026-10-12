import fs from 'node:fs';
import { config } from '../config.js';
import { initDb } from '../db/index.js';
import { runSyncOnce } from '../ticketing/sync.js';

if (!fs.existsSync(config.dataDir)) fs.mkdirSync(config.dataDir, { recursive: true });
initDb();

try {
  const summary = await runSyncOnce();
  console.log('\n[sync:now] result:', summary);
  process.exit(0);
} catch (err) {
  console.error('[sync:now] error:', err);
  process.exit(1);
}
