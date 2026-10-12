export async function analyze(query, topK = 8) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, topK }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

export async function getSyncStatus() {
  const res = await fetch('/api/admin/sync/status');
  return res.json();
}

export async function triggerSync() {
  const res = await fetch('/api/admin/sync/run', { method: 'POST' });
  return res.json();
}
