import React, { useEffect, useRef, useState } from 'react';
import { analyze, getSyncStatus, triggerSync } from './api.js';
import TicketCard from './components/TicketCard.jsx';
import ChatMessage from './components/ChatMessage.jsx';

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Describe the issue or topic you want to investigate. I\'ll search past tickets and summarize likely causes, fixes, and things to check.' },
  ]);
  const [tickets, setTickets] = useState([]);
  const [highlightId, setHighlightId] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sync, setSync] = useState(null);
  const [syncRunning, setSyncRunning] = useState(false);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
  }, [messages]);

  async function refreshSync() {
    try { setSync(await getSyncStatus()); } catch {}
  }
  useEffect(() => {
    refreshSync();
    const t = setInterval(refreshSync, 10000);
    return () => clearInterval(t);
  }, []);

  async function onSync() {
    setSyncRunning(true);
    try {
      await triggerSync();
      setTimeout(refreshSync, 1500);
    } finally {
      setTimeout(() => setSyncRunning(false), 1500);
    }
  }

  async function onSend() {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const result = await analyze(q, 8);
      setMessages((m) => [...m, { role: 'assistant', content: result.analysis }]);
      setTickets(result.tickets || []);
    } catch (err) {
      setMessages((m) => [...m, { role: 'error', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function onCite(ticketRef) {
    const t = tickets.find((t) => String(t.number) === ticketRef || String(t.id) === ticketRef);
    if (!t) return;
    setHighlightId(t.id);
    document.getElementById(`ticket-${t.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightId(null), 2000);
  }

  const lastSync = sync?.lastFinishedAt ? new Date(sync.lastFinishedAt).toLocaleString() : 'never';
  const total = sync?.totalTickets ?? 0;

  return (
    <div className="app">
      <header className="header">
        <h1>Neutara Ticket Agent</h1>
        <div className="sync-info">
          <span>{total} indexed · last sync: {lastSync}</span>
          <button onClick={onSync} disabled={syncRunning || sync?.running}>
            {sync?.running || syncRunning ? <><span className="spinner" /> syncing…</> : 'Sync now'}
          </button>
        </div>
      </header>

      <div className="layout">
        <section className="chat-panel">
          <div className="panel-title">Chat</div>
          <div className="chat-scroll" ref={chatScrollRef}>
            {messages.map((m, i) => <ChatMessage key={i} msg={m} onCite={onCite} />)}
            {loading && <div className="msg assistant">Thinking…</div>}
          </div>
          <div className="chat-input">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSend(); }}
              placeholder="e.g. OneDrive migration fails with throttling errors"
            />
            <button onClick={onSend} disabled={loading || !input.trim()}>Send</button>
          </div>
        </section>

        <section className="cards-panel">
          <div className="panel-title">Related tickets {tickets.length ? `(${tickets.length})` : ''}</div>
          <div className="cards-scroll">
            {tickets.length === 0
              ? <div className="empty">Ticket details will appear here after you send a query.</div>
              : tickets.map((t) => <TicketCard key={t.id} ticket={t} highlight={t.id === highlightId} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
