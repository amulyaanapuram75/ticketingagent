// Mapping tailored to Neutara's /api/issues response.
// If the API shape changes, re-run `npm run probe` to inspect and update.

function flattenComments(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (!Array.isArray(raw)) return '';
  return raw.map((c) => {
    if (typeof c === 'string') return c;
    if (!c || typeof c !== 'object') return '';
    const author = c.author?.displayName || c.author || c.user || c.createdBy?.displayName || '';
    const when = c.createdAt || c.created_at || c.date || '';
    const body = c.body || c.text || c.message || c.comment || c.content || '';
    return [author, when, typeof body === 'string' ? body : JSON.stringify(body)]
      .filter(Boolean)
      .join(' | ');
  }).filter(Boolean).join('\n---\n');
}

function statusName(s) {
  if (!s) return '';
  if (typeof s === 'string') return s;
  return s.name || s.status || s.label || '';
}

export function normalizeTicket(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const number = raw.key || raw.cfKey || String(raw.issueNumber ?? raw.id ?? '');
  const id = String(raw.id || raw.key || number);

  return {
    id,
    number,                                   // e.g. "L1BOAR-5142"
    cfKey: raw.cfKey || '',                   // e.g. "CF-22904"
    subject: raw.summary || raw.title || '',
    description: raw.description || '',
    rca: raw.rootCause || '',
    fixDescription: raw.fixDescription || '',
    aiRca: raw.aiSuggestedRootCause || '',
    aiFixDescription: raw.aiSuggestedFixDescription || '',
    status: statusName(raw.status),
    priority: raw.priority || '',
    type: raw.type || '',
    productType: raw.productType || '',
    combination: raw.combination || '',
    customerName: raw.customerName || raw.manageClientName || raw.clientName || '',
    comments: flattenComments(raw.comments),
    updatedAt: raw.updatedAt || raw.createdAt || '',
    url: raw.key ? `https://neutaraticketing.cftools.live/issues/${encodeURIComponent(raw.key)}` : null,
    raw,
  };
}
