# BreakFlow AI

BreakFlow AI is a browser resilience testing tool for web apps. Instead of only checking the happy path, it launches Playwright browser sessions that behave like difficult real users: impatient clickers, distracted form users, lost navigators, bad Wi-Fi users, privacy-first users, and more.

The app produces a resilience score, issue list, live runner log, screenshot evidence, repair recommendations, and downloadable PDF reports.

## What It Does

1. You enter a target URL.
2. You choose one or more user personas.
3. The backend launches Chromium with Playwright.
4. Each persona interacts with the target app in a different failure-oriented way.
5. BreakFlow captures browser errors, failed requests, duplicate submissions, layout issues, navigation problems, validation gaps, and missing fallback states.
6. The logger groups duplicate findings, captures screenshot evidence, and stores the result.
7. The report page shows the resilience score, issue severity, affected persona, screenshot evidence, recommended fixes, and export options.

## Hackathon Pitch

Traditional QA checks whether the normal user path works. BreakFlow checks whether the product survives real-world user chaos.

Use this story in a demo:

1. Open the dashboard.
2. Run BreakFlow against a demo checkout, signup, or dashboard app.
3. Show an issue found by a persona such as Impatient Buyer or Distracted Signup.
4. Open the report and point to the screenshot evidence.
5. Show the repair recommendation and resilience score.

## Personas

| Internal ID | Display Name | What It Simulates |
| --- | --- | --- |
| `rage-clicker` | Impatient Buyer | Rapid repeated clicks and double-submit behavior |
| `half-fill-user` | Distracted Signup | Partial forms, empty required fields, abandoned flows |
| `confused-navigator` | Lost Visitor | Back, forward, refresh, random navigation |
| `slow-network-user` | Bad Wi-Fi User | Slow 3G, high latency, offline transitions |
| `contradictory-input-user` | Hostile Inputter | XSS strings, SQL-like payloads, extreme values |
| `viewport-shifter` | Small-Screen User | Mobile/tablet resizing, overflow, tiny targets |
| `multi-tab-user` | Power Tabber | Two-tab state drift and concurrent actions |
| `permission-denier` | Privacy-First User | Denied browser permissions and missing fallbacks |

## Project Structure

```text
.
├── backend/
│   ├── server.js                  # Express API server
│   ├── db/schema.js               # Supabase client plus in-memory fallback
│   ├── routes/
│   │   ├── tests.js               # Start/list/stream test runs
│   │   └── reports.js             # Full report and PDF export routes
│   └── engine/
│       ├── orchestrator.js        # Runs Playwright personas and saves results
│       ├── logger.js              # Captures issues and screenshot evidence
│       ├── scorer.js              # Calculates the 0-100 resilience score
│       ├── recommender.js         # Rule-based and Codex-powered fix advice
│       ├── issueNormalizer.js     # Deduplicates repeated findings
│       ├── pdfReport.js           # PDF report generation
│       └── personas/              # Browser chaos personas
├── frontend/
│   └── src/app/
│       ├── page.js                # Landing page
│       ├── dashboard/page.js      # Test runner UI and live events
│       ├── report/[id]/page.js    # Report UI with evidence and fixes
│       └── components/            # Header, persona selector, gauge, feed
├── start.sh                       # Linux/macOS launcher
└── start.bat                      # Windows launcher
```

## Tech Stack

- Frontend: Next.js, React
- Backend: Express
- Browser automation: Playwright Chromium
- Storage: Supabase, with automatic in-memory fallback
- Reports: PDFKit
- AI repair help: OpenAI/Codex API through `CODEX_API_KEY`

## Setup

### Fast Start

On Linux/macOS:

```bash
chmod +x start.sh
./start.sh
```

On Windows:

```bat
start.bat
```

The launch scripts install dependencies, install the Playwright Chromium browser, and start both servers.

### Manual Start

Backend:

```bash
cd backend
npm install
npx playwright install chromium
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Backend health check:

```text
http://localhost:3001/api/health
```

## Environment Variables

Create `backend/.env` for optional services:

```env
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
CODEX_API_KEY=your_openai_or_codex_api_key
OPENAI_API_KEY=optional_fallback_openai_api_key
CODEX_MODEL=gpt-4o-mini
```

If both `CODEX_API_KEY` and `OPENAI_API_KEY` are set, `CODEX_API_KEY` wins. `CODEX_MODEL` controls the model used for report recommendations and one-click repair drafts. You can also use `OPENAI_MODEL` as a fallback model variable.

If Supabase is not configured, the backend uses in-memory storage. This is helpful for hackathon demos because the app still runs without database setup, but data disappears when the backend restarts.

## Supabase Tables

The SQL schema is included at the bottom of `backend/db/schema.js`.

Required tables:

- `test_runs`
- `test_issues`
- `test_recommendations`
- `test_events`

Screenshot evidence is stored on disk under `backend/evidence/` and referenced from each issue's `details.evidence.screenshotUrl` field.

## API Overview

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Backend health check |
| `GET` | `/api/personas` | List available personas |
| `POST` | `/api/tests` | Start a new browser test |
| `GET` | `/api/tests` | List recent test runs |
| `GET` | `/api/tests/:id` | Get one test run |
| `GET` | `/api/tests/:id/stream` | Live Server-Sent Events stream |
| `GET` | `/api/reports/:id` | Full report with issues, events, fixes |
| `GET` | `/api/reports/:id/pdf` | Download a PDF report |
| `GET` | `/api/codex/status` | Show API key source and model configuration |
| `POST` | `/api/codex/fix` | Generate a repair note for one issue |

The normal browser test uses local Playwright automation. OpenAI API usage is triggered by report recommendation generation after a run completes, and by the `Draft repair` button on an issue. The placeholder `/api/codex/test` route reports configuration status but does not currently call OpenAI.

Example test request:

```bash
curl -X POST http://localhost:3001/api/tests \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "personas": ["rage-clicker", "half-fill-user", "viewport-shifter"]
  }'
```

## How Scoring Works

The score starts at 100 and subtracts weighted penalties for grouped issues.

Penalty factors include:

- Severity: critical, warning, info
- Category: duplicate requests, UI freezes, network errors, responsive layout, etc.
- Occurrence count: repeated events increase the penalty, but are capped
- Persona spread: issues affecting multiple personas are more serious
- Category diversity: many kinds of failure reduce confidence

The output includes both a numeric score and a grade such as `A`, `B-`, or `F`.

## Screenshot Evidence

When the logger records a new issue, it captures a Playwright screenshot from the active page. The report page displays this image directly inside the issue card.

Evidence metadata is stored in the issue details:

```json
{
  "evidence": {
    "screenshotUrl": "/evidence/<test-run-id>/<file>.png",
    "capturedAt": "2026-07-14T00:00:00.000Z",
    "viewport": { "width": 1280, "height": 720 },
    "pageUrl": "https://target-app.example/page"
  }
}
```

## Notes for Demo Reliability

- Use the in-memory fallback if Supabase setup is not ready.
- Run against a known demo target so the findings are predictable.
- Use 2-3 personas in a live demo to keep runtime short.
- The best demo personas are usually Impatient Buyer, Distracted Signup, and Small-Screen User.
- Keep the report page open after a successful run so judges can inspect score, issue severity, screenshot evidence, and repair advice.

## Development Commands

Frontend:

```bash
cd frontend
npm run dev
npm run lint
npm run build
```

Backend:

```bash
cd backend
npm run dev
npm start
```

## Current Limitations

- Screenshot evidence is stored locally, so it is not durable across deployments unless `backend/evidence/` is persisted.
- The in-memory DB fallback is demo-friendly but not production storage.
- Playwright can only test URLs reachable from the backend machine.
- Some findings are heuristic and should be treated as strong signals, not absolute proof.
