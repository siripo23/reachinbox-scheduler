# ReachInbox.ai - Full-stack Email Job Scheduler

## Architecture Overview
This project consists of an Express.js backend and a React (Vite) frontend.
The backend handles API requests for scheduling emails, tracking rate limits, and communicating with BullMQ for background job processing.
- **Frontend**: React (Vite), TailwindCSS
- **Backend**: Node.js, Express, TypeScript, Prisma (PostgreSQL)
- **Queue/Scheduler**: BullMQ backed by Redis
- **Search**: Elasticsearch for indexing and searching emails

## How scheduling works
When a request comes in to schedule a campaign:
1. The backend saves the campaign and each individual email into PostgreSQL (status `SCHEDULED`).
2. The backend enqueues a delayed job in BullMQ for each email. The delay is calculated based on the start time and the configured delay between emails.
3. BullMQ manages the queue in Redis. It naturally supports delayed jobs, ensuring that the worker only processes them when the correct time arrives.

## How persistence on restart is handled
BullMQ stores all job data and state in Redis. If the Node.js server restarts, Redis retains the queued jobs. When the worker comes back online, it reconnects to Redis and resumes processing any pending or delayed jobs exactly where it left off. PostgreSQL serves as the persistent source of truth for the application state (what was scheduled vs sent).

## How rate limiting & concurrency are implemented
- **Concurrency**: BullMQ worker is configured with a concurrency limit (e.g., `WORKER_CONCURRENCY = 5`), meaning up to 5 jobs can run in parallel safely.
- **Rate Limiting**: Implemented via an atomic Redis counter for each sender per hour. If the limit is exceeded, the worker intercepts the job, alerts the user on Slack (if configured), and reschedules the job to the next available hour.
- **Delay**: A fixed manual delay (e.g., 2 seconds) is introduced in the worker logic to mimic provider throttling before sending via Ethereal SMTP.

## Prerequisites
- Node.js (v18+)
- Redis
- PostgreSQL
- Elasticsearch

## Setup Instructions

### Environment Variables
**Backend (`backend/.env`)**:
\`\`\`env
DATABASE_URL="postgresql://user:password@localhost:5432/reachinbox?schema=public"
REDIS_HOST="localhost"
REDIS_PORT=6379
ELASTICSEARCH_URL="http://localhost:9200"
PORT=3001
SMTP_HOST="smtp.ethereal.email"
SMTP_PORT=587
SMTP_USER="your_ethereal_user"
SMTP_PASS="your_ethereal_password"
\`\`\`

### Running the Backend
1. Generate an ethereal email account at https://ethereal.email/create and put the credentials in `backend/.env`.
2. Start infrastructure: \`docker compose up -d\` (Ensure Docker is installed).
3. \`cd backend\`
4. \`npm install\`
5. \`npx prisma db push\`
6. \`npm run dev\`

### Running the Frontend
1. \`cd frontend\`
2. \`npm install\`
3. \`npm run dev\`

## Features Implemented
### Backend:
- [x] Scheduler (BullMQ delayed jobs)
- [x] Persistence (Redis & Postgres)
- [x] Rate limiting & Slack notifications
- [x] Concurrency & provider delays
- [x] Elasticsearch Integration for searchable emails

### Frontend:
- [x] Google Login (OAuth Mock/Implementation)
- [x] Dashboard UI (Scheduled & Sent Tabs)
- [x] Compose modal/page (CSV parsing)
- [x] Clean tables & Tailwind styling
- [x] Search Bar integrating with Elasticsearch

## Assumptions & Trade-offs
1. **Google Auth**: We use a simple frontend verification for Google OAuth (`@react-oauth/google`) with the `jwt-decode` utility. In a strict production system, the JWT would also be cryptographically verified on the Express backend before establishing a session.
2. **Slack Notifications**: For demonstration purposes, Slack OAuth requests scopes for `chat:write`, and posts messages using `chat.postMessage`. This will post as the authorized user (or bot). 
3. **Queue Logic**: The worker sleeps for 2 seconds synchronously per job using a manual `setTimeout` to mimic provider delays. BullMQ has a `RateLimiter` feature for this, but implementing it manually with a Redis counter allows tighter control over custom tenant limits and direct hooks to send a Slack notification exactly when the boundary is hit.
4. **Error Handling**: Hard failures (like SMTP auth failure) update the email status to `FAILED`. BullMQ will inherently retry based on configurations, but we have omitted infinite retries to prevent blocking the queue with dead jobs during testing.
