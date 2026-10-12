import React from 'react';

function Field({ label, value, tone }) {
  if (!value) return null;
  return (
    <details>
      <summary className={tone ? `tone-${tone}` : ''}>{label}</summary>
      <div className="body">{value}</div>
    </details>
  );
}

export default function TicketCard({ ticket, highlight }) {
  const t = ticket;
  const sourceUrl = t.url || `https://neutaraticketing.cftools.live/issues/${encodeURIComponent(t.number || t.id)}`;
  const chips = [
    t.status,
    t.priority,
    t.productType,
    t.combination,
    t.customerName && `cust: ${t.customerName}`,
  ].filter(Boolean);

  return (
    <div id={`ticket-${t.id}`} className={`ticket-card${highlight ? ' highlight' : ''}`}>
      <div className="row">
        <span className="number">#{t.number || t.id}{t.cfKey && t.cfKey !== t.number ? ` · ${t.cfKey}` : ''}</span>
        {typeof t.similarity === 'number' && (
          <span className="meta">similarity {(t.similarity * 100).toFixed(0)}%</span>
        )}
      </div>
      <h3>{t.subject || '(no subject)'}</h3>
      <div className="chips">
        {chips.map((c, i) => <span key={i} className="chip">{c}</span>)}
      </div>
      <div className="meta">
        {t.updatedAt && <>updated {new Date(t.updatedAt).toLocaleString()} · </>}
        <a className="open" href={sourceUrl} target="_blank" rel="noreferrer">open in Neutara ↗</a>
      </div>
      <Field label="Description" value={t.description} />
      <Field label="Root cause (human)" value={t.rca} tone="human" />
      <Field label="Root cause (AI-suggested)" value={t.aiRca} tone="ai" />
      <Field label="Fix (human)" value={t.fixDescription} tone="human" />
      <Field label="Fix (AI-suggested)" value={t.aiFixDescription} tone="ai" />
      <Field label="Comments" value={t.comments} />
    </div>
  );
}
