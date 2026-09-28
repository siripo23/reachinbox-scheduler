# ReachInbox Email Scheduler

A production-grade email job scheduler with a React dashboard. Schedule bulk emails with BullMQ + Redis, send via Ethereal Email (fake SMTP), persist state across restarts, and monitor live queues via Bull Board.

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for Redis, PostgreSQL, Elasticsearch)

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This spins up:
- **PostgreSQL** on port `5432`
- **Redis** on port `6379`
- **Elasticsearch** on port `9200`

---

### 2. Backend Setup

```bash
cd backend
cp .env.example .env   # edit with your credentials (see below)
npm install
npm run db:generate    # generate Prisma client
npm run db:migrate     # run DB migrations
npm run dev            # starts on http://localhost:3001
```

**BullMQ Dashboard** is live at: `http://localhost:3001/admin/queues`

---

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env.local   # add your Google OAuth client ID
npm install
npm run dev                  # starts on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## ⚙️ Environment Variables

### `backend/.env`

```env
# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/reachinbox?schema=public"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# Elasticsearch
ELASTICSEARCH_URL="http://localhost:9200"

# Express
PORT=3001

# Ethereal Email — get free credentials at https://ethereal.email/create
SMTP_HOST="smtp.ethereal.email"
SMTP_PORT=587
SMTP_USER="your_ethereal_user@ethereal.email"
SMTP_PASS="your_ethereal_password"

# Slack OAuth (optional — for rate-limit notifications)
SLACK_CLIENT_ID="your_slack_client_id"
SLACK_CLIENT_SECRET="your_slack_client_secret"

# Worker tuning (optional)
WORKER_CONCURRENCY=5          # parallel email jobs
MIN_SEND_DELAY_MS=2000        # min 2s between sends
MAX_EMAILS_PER_HOUR=200       # global fallback hourly cap
```

### Setting up Ethereal Email

1. Go to [https://ethereal.email/create](https://ethereal.email/create)
2. Click **Create Ethereal Account** — you get an instant fake inbox
3. Copy the SMTP credentials into `SMTP_USER` and `SMTP_PASS`
4. After emails are "sent", view them at [https://ethereal.email/messages](https://ethereal.email/messages)

### `frontend/.env.local`

```env
VITE_GOOGLE_CLIENT_ID="your_google_oauth_client_id"
VITE_SLACK_CLIENT_ID="your_slack_app_client_id"
```

To get a Google Client ID:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials (Web application)
3. Add `http://localhost:5173` to Authorized JavaScript origins

---

## 🏗 Architecture Overview

```
┌─────────────────┐     REST API      ┌──────────────────────────┐
│  React Frontend │ ◄────────────────► │  Express Backend :3001   │
│  Vite + Tailwind│                   │                          │
│  :5173          │                   │  /api/auth               │
└─────────────────┘                   │  /api/campaigns          │
                                      │  /admin/queues (BullBoard│
                                      └──────────┬───────────────┘
                                                 │
                          ┌──────────────────────┼──────────────────────┐
                          │                      │                      │
                   ┌──────▼──────┐      ┌────────▼───────┐    ┌────────▼───────┐
                   │  PostgreSQL │      │     Redis       │    │ Elasticsearch  │
                   │  (Prisma)   │      │  (BullMQ Queue) │    │ (Email Search) │
                   └─────────────┘      └────────┬───────┘    └────────────────┘
                                                 │
                                        ┌────────▼───────┐
                                        │  BullMQ Worker │
                                        │  (concurrency=5│
                                        │  minDelay=2s)  │
                                        └────────┬───────┘
                                                 │
                                        ┌────────▼───────┐
                                        │ Ethereal Email │
                                        │   (fake SMTP)  │
                                        └────────────────┘
```

---

## 📋 How It Works

### Scheduling

1. User fills the Compose form (subject, body, CSV of emails, start time, delay, hourly limit)
2. Backend creates a `Campaign` + one `ScheduledEmail` record per address in PostgreSQL
3. Each email is enqueued as a **BullMQ delayed job** with `delay = startTime + (i × delaySeconds) - now`
4. Jobs sit in Redis until their delay expires, then the worker picks them up
5. **No cron jobs** — purely BullMQ delayed jobs

### Persistence on Restart

- BullMQ jobs are stored in **Redis** with `removeOnComplete: false` and `removeOnFail: false`
- On server restart, the worker reconnects to the same Redis queue — pending/delayed jobs are still there and fire at the correct time
- Job IDs use the pattern `email-<scheduledEmailId>` (idempotency key) — rescheduling the same email does not create a duplicate

### Rate Limiting

- Each worker job increments a **Redis counter** keyed by `rate-limit:<userId>:<YYYY-MM-DDTHH>`
- Counter auto-expires after 3600 seconds
- If `count > hourlyLimit`, the job is **rescheduled** to the next full hour (`now + msUntilNextHour`) — it is never dropped
- Safe across multiple workers/instances because Redis INCR is atomic
- On the **first over-limit hit** in an hour, a Slack message is posted to the user's connected workspace

### Concurrency

- Worker runs with configurable `concurrency` (default: 5 via `WORKER_CONCURRENCY` env)
- Each concurrent job waits a minimum of `MIN_SEND_DELAY_MS` (default: 2000ms) before sending — mimics provider throttling

---

## ✅ Features Implemented

### Backend
| Feature | Implementation |
|---|---|
| Email scheduling | BullMQ delayed jobs — no cron |
| Persistence on restart | Jobs stored in Redis, reconnect on boot |
| Rate limiting | Redis atomic INCR counter per user per hour |
| Rescheduling on rate limit | Delayed to next hour window, order preserved |
| Concurrency | BullMQ worker `concurrency` option (configurable) |
| Min delay between sends | `setTimeout(MIN_SEND_DELAY_MS)` in worker |
| Idempotency | Job ID = `email-<scheduledEmailId>` — no duplicates |
| Slack notification | Real OAuth flow, posts on first rate-limit hit |
| Elasticsearch indexing | Emails indexed on send, searchable by address/subject/body |
| BullMQ live dashboard | `http://localhost:3001/admin/queues` |
| SMTP sending | Nodemailer via Ethereal fake SMTP |
| DB persistence | Prisma ORM + PostgreSQL (Campaign, ScheduledEmail, User) |

### Frontend
| Feature | Implementation |
|---|---|
| Google OAuth login | `@react-oauth/google` — real Google sign-in |
| User session | Stored in `localStorage` via React Context |
| Dashboard | Scheduled + Sent tabs, status badges, email table |
| Search | Debounced Elasticsearch search across emails |
| Compose form | Subject, body, CSV upload, start time, delay, hourly limit |
| CSV parsing | Regex email extraction, deduplication, count display |
| Slack connect | OAuth button in header → real Slack OAuth flow |
| Loading states | Spinner on all async operations |
| Empty states | Friendly message when no emails found |
| Logout | Google logout + session clear |

---

## 📝 Assumptions & Trade-offs

- **Google OAuth is real** — you must supply your own `VITE_GOOGLE_CLIENT_ID`. The backend stores user by email only (no JWT verification on backend routes — acceptable for an intern assignment scope).
- **Elasticsearch is optional** — if ES is down the app still works fully; search returns empty results gracefully.
- **Slack channel** defaults to `#general` if the user hasn't set a specific channel. The Slack OAuth flow stores the bot token; the first rate-limit hit each hour triggers a real Slack message.
- **Delay accuracy** — BullMQ delayed jobs have ~1s granularity. For a demo this is fine; production would use a more precise scheduler.
- **No auth middleware** on API routes — acceptable for this scope. Production would add JWT verification.
- **Min send delay is worker-side** — with `concurrency=5` and `minDelay=2s`, up to 5 emails can be sending concurrently each with their own 2s internal delay. Effective throughput is ~150 emails/min under these settings.
