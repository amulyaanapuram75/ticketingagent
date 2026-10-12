# Neutara Ticket Agent

AI agent + dashboard that lets you type a topic (e.g. *"OneDrive migration failing with throttling"*) and instantly see:

- An LLM-written summary of likely root causes, suggested fixes, and things to check — with inline citations like `[#1234]`
- The actual related tickets (subject, description, RCA, fix, comments, status, link back to Neutara) on the right side

Under the hood the backend periodically pulls tickets from `https://neutaraticketing.cftools.live`, embeds them with OpenAI, and stores them in a local SQLite + `sqlite-vec` index. Queries do semantic retrieval then feed GPT for analysis.

## Stack

- **Frontend:** React + Vite (split layout — chat on left, ticket cards on right)
- **Backend:** Node.js + Express
- **Vector store:** `better-sqlite3` + `sqlite-vec` (local, no external service)
- **AI:** OpenAI (`text-embedding-3-small` for embeddings, `gpt-4o-mini` for analysis — both configurable)
- **Scheduler:** `node-cron` (every N hours, configurable)

## One-time setup

```powershell
# 1. Install dependencies for root, backend, and frontend
npm install
npm run install:all

# 2. Create your .env from the template and fill in keys
copy .env.example .env
# then edit .env and set:
#   OPENAI_API_KEY=sk-...
#   TICKETING_API_KEY=<your Neutara API key>

# 3. Discover the ticketing API shape (tries common endpoints + auth styles,
#    then writes TICKETING_AUTH_STYLE / TICKETING_LIST_ENDPOINT back into .env,
#    and writes a field map to backend/src/ticketing/mapping.js)
npm run probe

# 4. Pull every ticket and build the embedding index (one-off; after this,
#    the scheduler keeps it fresh every SYNC_INTERVAL_HOURS)
npm run sync:now
```

Open `backend/src/ticketing/mapping.js` after probing to confirm the field names look right (especially `fixDescription`, `rca`, `comments`). Fix any wrong mapping and re-run `npm run sync:now`.

## Run the app

```powershell
npm run dev
```

- Backend: http://localhost:5174
- Frontend: http://localhost:5173 (Vite proxies `/api/*` to the backend)

Open the frontend URL and start querying. The header shows how many tickets are indexed and when the last sync ran; click **Sync now** to force an immediate refresh.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI key | *required* |
| `OPENAI_CHAT_MODEL` | Model for analysis | `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | Model for embeddings | `text-embedding-3-small` |
| `TICKETING_BASE_URL` | Neutara base URL | `https://neutaraticketing.cftools.live` |
| `TICKETING_API_KEY` | Neutara API key | *required* |
| `TICKETING_AUTH_STYLE` | `bearer` / `x-api-key` / `api-key` / `query` | auto-detected by probe |
| `TICKETING_LIST_ENDPOINT` | e.g. `/api/tickets` | auto-detected by probe |
| `SYNC_INTERVAL_HOURS` | How often the scheduler pulls new tickets | `6` |
| `SYNC_PAGE_SIZE` | Page size per API call | `100` |
| `SYNC_ON_STARTUP` | Run a sync when the server boots | `true` |
| `PORT` | Backend port | `5174` |

## HTTP API (backend)

- `POST /api/analyze` — `{ query, topK? }` → `{ analysis, tickets: [...] }`
- `GET  /api/tickets` — paginated list (query params: `limit`, `offset`, `q`)
- `GET  /api/tickets/:id` — single ticket
- `GET  /api/admin/sync/status` — current sync state
- `POST /api/admin/sync/run` — kick off a sync immediately
- `GET  /api/health`

## Project layout

```
Agent/
├─ package.json            # root scripts: install:all, dev, probe, sync:now
├─ .env.example
├─ backend/
│  ├─ package.json
│  ├─ data/                # created at runtime: tickets.db + WAL files
│  └─ src/
│     ├─ index.js          # express server + scheduler bootstrap
│     ├─ config.js
│     ├─ cli/
│     │  ├─ probe.js       # `npm run probe`
│     │  └─ syncNow.js     # `npm run sync:now`
│     ├─ db/index.js       # sqlite-vec setup + upsert + search
│     ├─ openai/client.js  # embeddings + chat
│     ├─ ticketing/
│     │  ├─ client.js      # auth-style-tolerant HTTP client
│     │  ├─ probe.js       # endpoint discovery
│     │  ├─ mapping.js     # field map (auto-filled by probe)
│     │  └─ sync.js        # pagination + embedding batch + cron
│     ├─ agent/analyze.js  # retrieve + prompt + call GPT
│     └─ routes/           # /analyze, /tickets, /admin
└─ frontend/
   ├─ vite.config.js       # proxies /api → :5174
   ├─ index.html
   └─ src/
      ├─ App.jsx           # layout + state
      ├─ api.js
      ├─ styles.css
      └─ components/
         ├─ ChatMessage.jsx  # citations [#1234] clickable
         └─ TicketCard.jsx
```

## Troubleshooting

- **`npm run probe` reports no endpoint matched.** The ticketing API path isn't in the default candidate list. Open the Neutara dashboard, find a network request in DevTools, and set `TICKETING_LIST_ENDPOINT` + `TICKETING_AUTH_STYLE` in `.env` manually.
- **Fields in the ticket cards are empty.** The probe guessed the wrong field names. Edit `backend/src/ticketing/mapping.js` and re-run `npm run sync:now`.
- **`better-sqlite3` build fails on Windows.** You need Visual Studio Build Tools (C++ workload) and Python 3.x. Install them, then re-run `npm --prefix backend install`.
- **Rate-limit errors from OpenAI during a sync.** Lower `SYNC_PAGE_SIZE` and/or add a sleep between batches in `backend/src/ticketing/sync.js`.
