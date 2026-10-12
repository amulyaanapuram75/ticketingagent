import React from 'react';

const CITE_RE = /\[#?([A-Za-z0-9][A-Za-z0-9_-]*)\]/g;

// Render inline Markdown: **bold**, *italic*, `code`, and [#TICKET] citations.
function renderInline(text, onCite, keyPrefix) {
  const nodes = [];
  // Walk by segments, handling citations first (highest priority), then markdown.
  let i = 0;
  let last = 0;
  const push = (s, extraKey) => {
    if (!s) return;
    nodes.push(...renderMarkdownInline(s, keyPrefix + '-' + nodes.length + (extraKey || '')));
  };
  CITE_RE.lastIndex = 0;
  let m;
  while ((m = CITE_RE.exec(text)) !== null) {
    if (m.index > last) push(text.slice(last, m.index));
    const ref = m[1];
    nodes.push(
      <span key={`${keyPrefix}-c-${m.index}`} className="cite" onClick={() => onCite(ref)}>
        [#{ref}]
      </span>
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) push(text.slice(last));
  return nodes;
}

function renderMarkdownInline(text, baseKey) {
  // Handles **bold**, *italic*, and `inline code`.
  const tokens = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      tokens.push(<strong key={`${baseKey}-b${i}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      tokens.push(<code key={`${baseKey}-c${i}`}>{token.slice(1, -1)}</code>);
    } else {
      tokens.push(<em key={`${baseKey}-i${i}`}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
    i++;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens.length ? tokens : [text];
}

function renderMarkdown(text, onCite) {
  const lines = text.split('\n');
  const blocks = [];
  let listBuf = null;

  const flushList = () => {
    if (!listBuf) return;
    const { type, items, keyPrefix } = listBuf;
    const Tag = type;
    blocks.push(
      <Tag key={keyPrefix}>
        {items.map((it, idx) => (
          <li key={`${keyPrefix}-${idx}`}>{renderInline(it, onCite, `${keyPrefix}-${idx}`)}</li>
        ))}
      </Tag>
    );
    listBuf = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushList(); return; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      const Tag = `h${Math.min(level + 1, 6)}`; // demote one level so h3 fits chat context
      blocks.push(<Tag key={`h-${idx}`}>{renderInline(h[2], onCite, `h-${idx}`)}</Tag>);
      return;
    }

    const ol = line.match(/^(\d+)\.\s+(.*)$/);
    const ul = line.match(/^[-*•]\s+(.*)$/);
    if (ol) {
      if (!listBuf || listBuf.type !== 'ol') { flushList(); listBuf = { type: 'ol', items: [], keyPrefix: `ol-${idx}` }; }
      listBuf.items.push(ol[2]);
      return;
    }
    if (ul) {
      if (!listBuf || listBuf.type !== 'ul') { flushList(); listBuf = { type: 'ul', items: [], keyPrefix: `ul-${idx}` }; }
      listBuf.items.push(ul[1]);
      return;
    }

    flushList();
    blocks.push(<p key={`p-${idx}`}>{renderInline(line, onCite, `p-${idx}`)}</p>);
  });
  flushList();
  return blocks;
}

export default function ChatMessage({ msg, onCite }) {
  const cls = msg.role === 'user' ? 'msg user'
            : msg.role === 'error' ? 'msg error'
            : 'msg assistant';
  if (msg.role !== 'assistant') {
    return <div className={cls}>{msg.content}</div>;
  }
  return <div className={cls}>{renderMarkdown(msg.content, onCite)}</div>;
}
