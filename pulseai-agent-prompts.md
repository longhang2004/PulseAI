# PulseAI — AI Agent Build Prompts (Phase by Phase)

> **Project:** PulseAI — Production Observability Platform with AI-Powered Diagnosis  
> **Concept:** Developers send their production logs, traces, and metrics to PulseAI. The platform analyzes patterns, detects anomalies, and uses AI to generate human-readable incident reports and root cause hypotheses — automatically, without someone needing to ask.  
> **Stack:** NestJS · Java Spring Boot · Next.js 15 · Kafka · Docker · PostgreSQL · TimescaleDB · Redis  
> **Real value:** Existing observability tools (Datadog, Grafana) show you the data. PulseAI tells you what it means and what to do. The gap is the AI diagnosis layer on top of raw telemetry — and this is something no open-source tool does well today.

---

## PHASE 0 — Project Bootstrap & CLAUDE.md

```
You are a senior platform engineer. I am building a project called **PulseAI** — a production observability platform that ingests logs, traces, and metrics from running applications, analyzes them in real-time using AI, and surfaces actionable incident reports with root cause hypotheses.

## Core concepts to understand before scaffolding:

- **Signal:** A single unit of telemetry — a log line, a trace span, or a metric data point
- **Stream:** A named, continuous channel of signals from one application/service (e.g. "api-gateway-prod")
- **Incident:** An automatically detected anomaly or degradation event with a lifecycle: OPEN → INVESTIGATING → RESOLVED | IGNORED
- **Diagnosis:** An AI-generated analysis of an incident: root cause hypothesis, severity, recommended actions
- **Alert Rule:** A user-defined condition that triggers an incident (e.g. error rate > 5% for 60s)

## Your task for this phase:

1. Scaffold the monorepo:
   ```
   pulseai/
   ├── CLAUDE.md
   ├── docker-compose.yml
   ├── docker-compose.dev.yml
   ├── .env.example
   ├── .gitignore
   ├── README.md
   ├── services/
   │   ├── ingest-gateway/        # NestJS — receives signals via HTTP/SDK
   │   ├── stream-processor/      # Java Spring Boot — real-time analysis engine
   │   ├── diagnosis-service/     # NestJS — LLM-powered incident diagnosis
   │   ├── alert-service/         # NestJS — rule evaluation + notifications
   │   └── api-service/           # NestJS — REST API for frontend + external queries
   └── frontend/                  # Next.js 15 — observability dashboard
   ```

2. Create `CLAUDE.md` with:
   - Project overview and the key differentiation: "We don't just show data — we explain it"
   - Core concepts glossary (Signal, Stream, Incident, Diagnosis, Alert Rule)
   - Signal schema (source of truth — all services must use this):
     ```typescript
     // Log signal
     { type: "LOG", streamId, timestamp, level: "DEBUG|INFO|WARN|ERROR|FATAL", message, attributes: object, traceId?: string }
     // Metric signal  
     { type: "METRIC", streamId, timestamp, name, value: number, unit, tags: object }
     // Trace signal
     { type: "TRACE", streamId, timestamp, traceId, spanId, parentSpanId?, operationName, durationMs, status: "OK|ERROR", attributes: object }
     ```
   - Kafka topic naming: `pulseai.signals.<type>` (log/metric/trace), `pulseai.incidents.<event>` (created/updated/resolved), `pulseai.alerts.<event>`
   - Ports: ingest-gateway=3000, stream-processor=8080, diagnosis-service=3001, alert-service=3002, api-service=3003, frontend=4000
   - TimescaleDB hypertable strategy: signals stored in `signals` hypertable partitioned by `timestamp`, 7-day retention policy
   - API response format: `{ success, data, error, meta }`
   - Docker network: `pulseai-net`

3. Create `docker-compose.yml` with:
   - PostgreSQL with TimescaleDB extension (`timescale/timescaledb:latest-pg16`)
   - Redis (port 6379)
   - Kafka + Zookeeper (port 9092)
   - Kafka UI (port 8090)
   - All 5 services + frontend
   - Shared `pulseai-net` network
   - Health checks on all infrastructure

4. `.env.example` with all vars grouped by service including: `LLM_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SIGNAL_RETENTION_DAYS=7`

5. Initialize all service folders with minimal entrypoints only.

Start with CLAUDE.md, then scaffold.
```

---

## PHASE 1 — Ingest Gateway (NestJS)

```
## Context
Refer to CLAUDE.md. This phase builds `services/ingest-gateway` — the front door for all telemetry data. Applications send their logs, metrics, and traces here. High-throughput, minimal processing, fast ack.

## Your task:

### 1. Auth — API Key based (not JWT)
- Developers authenticate via `X-API-Key` header (not JWT — SDKs don't do user sessions)
- API keys are tied to a `Project` entity
- `POST /projects` + `POST /projects/:id/keys` endpoints for key management (JWT-protected for web UI)
- Validate API key → resolve `projectId` → attach to request context
- Cache API key → projectId mapping in Redis (TTL: 5min) to avoid DB hit per signal

### 2. Signal Ingestion Endpoints

**Batch ingest (primary endpoint):**
- `POST /ingest` — accepts array of signals (max 1000 per request)
- Body: `{ signals: Signal[] }` where Signal matches schema from CLAUDE.md
- Validate each signal (type, required fields, timestamp not in future, not older than 7 days)
- Enrich each signal: add `projectId`, `receivedAt`, generate `signalId (uuid)`
- Publish valid signals to appropriate Kafka topics in batch
- Return: `{ accepted: N, rejected: M, errors: [{ index, reason }] }`

**Single signal (convenience endpoint):**
- `POST /ingest/log` — single log signal
- `POST /ingest/metric` — single metric signal
- `POST /ingest/trace` — single trace signal

**SDK heartbeat:**
- `POST /ingest/heartbeat` — `{ streamId, sdkVersion, language }` — track which streams are active
- Store last heartbeat in Redis: `pulseai:heartbeat:<streamId>` with 5min TTL

### 3. Performance Requirements
- This is the hottest path — optimize for throughput
- Use `fastify` adapter instead of default Express: `NestFactory.create(AppModule, new FastifyAdapter())`
- Kafka publish must be fire-and-forget (don't await ack per signal) — use `producer.send()` with `acks: 0` for signal topics
- Validate signals with a compiled JSON Schema validator (`ajv`) — NOT class-validator (too slow for bulk)
- Target: handle 10,000 signals/minute on a single instance

### 4. Stream Auto-registration
- On first signal from an unknown `streamId`: create `Stream` record in PostgreSQL
- Stream entity: `{ id, projectId, name (= streamId), firstSeenAt, lastSignalAt, signalCount }`
- Update `lastSignalAt` and increment `signalCount` via Redis counter (batch flush to DB every 60s via cron)

### 5. Rate Limiting
- Per API key: 10,000 signals/minute (count in Redis sliding window)
- Return `429` with `Retry-After` header when exceeded
- Soft limit at 8,000: add `X-RateLimit-Warning: true` header

## Constraints:
- Never store raw signals in PostgreSQL here — only metadata (Stream, Project). Signals go to Kafka → TimescaleDB via stream-processor
- Validate `timestamp` field: reject if more than 7 days old or more than 60 seconds in the future
- Write load test using `autocannon` targeting 500 req/s with 100-signal batches — document results in `LOAD_TEST.md`
```

---

## PHASE 2 — Stream Processor (Java Spring Boot)

```
## Context
Refer to CLAUDE.md. This is the Java service — the real-time analysis engine. It consumes signals from Kafka, persists them to TimescaleDB, runs anomaly detection, and triggers incidents.

## Your task:

### 1. Signal Consumers
Consume all three signal topics concurrently using separate `@KafkaListener` methods with different consumer groups:
- `pulseai.signals.log` → `LogSignalProcessor`
- `pulseai.signals.metric` → `MetricSignalProcessor`
- `pulseai.signals.trace` → `TraceSignalProcessor`

**Each processor must:**
1. Deserialize signal JSON
2. Persist to TimescaleDB via `signals` hypertable (unified table, `type` column discriminates)
3. Update in-memory sliding window stats for the stream (see Anomaly Detection below)
4. Check anomaly conditions

### 2. TimescaleDB Schema
Create via Flyway migration:
```sql
CREATE TABLE signals (
  signal_id UUID NOT NULL,
  project_id UUID NOT NULL,
  stream_id TEXT NOT NULL,
  type TEXT NOT NULL,          -- LOG | METRIC | TRACE
  timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  level TEXT,                  -- for LOG
  message TEXT,                -- for LOG
  metric_name TEXT,            -- for METRIC
  metric_value DOUBLE PRECISION, -- for METRIC
  metric_unit TEXT,            -- for METRIC
  trace_id TEXT,               -- for TRACE
  span_id TEXT,                -- for TRACE
  duration_ms BIGINT,          -- for TRACE
  status TEXT,                 -- for TRACE
  operation_name TEXT,         -- for TRACE
  attributes JSONB,
  PRIMARY KEY (signal_id, timestamp)
);
SELECT create_hypertable('signals', 'timestamp');
CREATE INDEX ON signals (stream_id, timestamp DESC);
CREATE INDEX ON signals (project_id, type, timestamp DESC);
```
Also add a TimescaleDB continuous aggregate for 1-minute bucketed error rates per stream.

### 3. Anomaly Detection Engine
Build `AnomalyDetectionEngine` with in-memory sliding windows (1-minute, 5-minute) per stream stored in a `ConcurrentHashMap<String, StreamStats>`:

**`StreamStats` tracks:**
- Total signal count (last 1 min, 5 min)
- Error/WARN count (last 1 min)
- Error rate (errors / total)
- P50, P95, P99 trace duration (last 5 min, using a reservoir sampler)
- Metric values per metric name (last 10 values, for spike detection)

**Built-in anomaly detectors (each is a Spring `@Component` implementing `AnomalyDetector`):**

| Detector | Trigger Condition |
|---|---|
| `ErrorRateSpikeDetector` | Error rate > 10% AND > 10 errors in last 1 min |
| `ErrorBurstDetector` | > 50 ERROR logs in any 60s window |
| `LatencyDegradationDetector` | P95 trace duration increases > 200% vs previous 5-min window |
| `MetricSpikeDetector` | Any metric value > 3 standard deviations from recent mean |
| `TraceErrorRateDetector` | > 5% of trace spans have status=ERROR in last 5 min |
| `SilenceDetector` | Stream had signals, then no signals for > 5 min (check via heartbeat) |

**When anomaly detected:**
1. Check if an open incident already exists for this stream + anomaly type (avoid duplicate incidents)
2. If no open incident: create `Incident` in PostgreSQL, publish `pulseai.incidents.created` to Kafka
3. If existing open incident: update `updatedAt`, publish `pulseai.incidents.updated`

### 4. Incident Entity (PostgreSQL, via Spring Data JPA)
```java
// Incident { id, projectId, streamId, type (enum), severity (LOW/MEDIUM/HIGH/CRITICAL),
//            status (OPEN/INVESTIGATING/RESOLVED/IGNORED), title, detectedAt,
//            resolvedAt, triggerValue, triggerThreshold, signalWindowStart, signalWindowEnd }
```
Severity mapping: ErrorBurst/LatencyDegradation → HIGH, MetricSpike → MEDIUM, others → based on magnitude.

### 5. Auto-Resolution
A `@Scheduled(fixedDelay = 60000)` job checks open incidents:
- If the anomaly condition is no longer true for the stream → mark RESOLVED, publish `pulseai.incidents.resolved`
- Resolution requires condition to be clear for 3 consecutive checks (use Redis counter per incident)

## Constraints:
- Sliding window state is in-memory only — on restart, windows rebuild from last 5 min of TimescaleDB data (implement `WindowRecoveryService` that runs on startup)
- Write unit tests for each `AnomalyDetector` with synthetic `StreamStats` inputs
- TimescaleDB retention policy: set via Flyway `SELECT add_retention_policy('signals', INTERVAL '7 days')`
- Use virtual threads (Java 21) for Kafka consumer processing: `spring.kafka.listener.concurrency=20`
```

---

## PHASE 3 — Diagnosis Service (NestJS)

```
## Context
Refer to CLAUDE.md. This service consumes incident events and generates AI-powered diagnoses. It is the core differentiator of PulseAI — turning raw anomaly detection into human-readable, actionable insights.

## Your task:

### 1. Kafka Consumer
- Consume `pulseai.incidents.created` → trigger diagnosis generation
- Do NOT diagnose on `updated` events (avoid LLM spam) — only on `created` and when user explicitly requests re-diagnosis

### 2. Diagnosis Generation Pipeline

**`DiagnosisService.generateDiagnosis(incidentId)`:**

**Step 1: Evidence Collection**
Query TimescaleDB for the 5-minute window around incident detection:
- Last 100 ERROR/FATAL log messages for the stream
- P50/P95/P99 trace durations (compare to previous hour baseline)
- Top 5 most frequent log patterns (normalize with regex: replace UUIDs, numbers, file paths)
- Any metric spikes in the window
- Stack traces extracted from log messages (regex: lines starting with `at ` or `Caused by:`)

**Step 2: Context Building**
Build a structured evidence object:
```typescript
{
  incident: { type, severity, triggerValue, triggerThreshold, detectedAt },
  stream: { name, projectName },
  evidence: {
    errorLogs: string[],        // top 20 most recent error messages
    topPatterns: { pattern: string, count: number }[],
    stackTraces: string[],      // extracted stack traces (max 3)
    latencyBaseline: { p50, p95, p99 },
    latencyCurrent: { p50, p95, p99 },
    metricSpikes: { name, baseline, current }[]
  }
}
```

**Step 3: LLM Diagnosis**
Build the prompt:
```
You are an expert SRE analyzing a production incident.

Incident: {{ incident.type }} on stream "{{ stream.name }}"
Severity: {{ incident.severity }}
Detected at: {{ incident.detectedAt }}

Evidence:
- Error rate: {{ incident.triggerValue }}% (threshold: {{ incident.triggerThreshold }}%)
- Top error patterns:
  {{ evidence.topPatterns }}
- Stack traces found:
  {{ evidence.stackTraces }}
- Latency change: P95 {{ latencyBaseline.p95 }}ms → {{ latencyCurrent.p95 }}ms

Respond ONLY with valid JSON:
{
  "rootCauseSummary": "one sentence",
  "rootCauseDetail": "2-3 sentences with technical specifics",
  "confidence": "LOW|MEDIUM|HIGH",
  "contributingFactors": ["...", "..."],
  "immediateActions": ["...", "..."],
  "investigationSteps": ["...", "..."],
  "preventionRecommendations": ["...", "..."],
  "relatedSignals": ["mention any trace IDs or patterns worth investigating"]
}
```

Call configured LLM provider (Anthropic Claude Sonnet preferred for quality).

**Step 4: Persist & Publish**
- Store `Diagnosis` in PostgreSQL: `{ id, incidentId, evidence (jsonb), llmResponse (jsonb), confidence, generatedAt, modelUsed, inputTokens, outputTokens }`
- Publish `pulseai.incidents.updated` with `{ incidentId, diagnosisReady: true }`

### 3. Re-diagnosis Endpoint
- `POST /diagnosis/:incidentId/regenerate` — force new diagnosis (rate limited: once per 5 min per incident, use Redis)
- Useful when user adds notes or incident evolves

### 4. Diagnosis Quality Feedback
- `POST /diagnosis/:id/feedback` — `{ helpful: boolean, notes?: string }`
- Store feedback for future prompt improvement tracking
- This is good OSS community signal

### 5. LLM Fallback
If LLM call fails or times out (10s):
- Generate a rule-based fallback diagnosis (no LLM):
  - Map `incident.type` to a template message
  - Populate `immediateActions` from a static playbook per incident type
  - Set `confidence: "LOW"`, `rootCauseSummary: "Automated analysis unavailable — manual investigation required"`
- Always deliver a diagnosis, never leave incident without one

## Constraints:
- Never include raw log messages longer than 200 chars in the LLM prompt — truncate with `...`
- Cap total prompt size at 3000 tokens (estimate: 4 chars/token) — trim evidence arrays to fit
- Write unit tests for: evidence collector, prompt builder, JSON response parser, fallback diagnosis generator
- LLM calls must be wrapped in a circuit breaker (3 failures → open for 2 min)
```

---

## PHASE 4 — Alert Service & API Service (NestJS)

```
## Context
Refer to CLAUDE.md. This phase builds two supporting services.

---

## PART A: Alert Service (`services/alert-service`)

### Purpose
Evaluates user-defined alert rules against incoming incident events and sends notifications.

### Alert Rule Entity (PostgreSQL):
- `id, projectId, name, condition (jsonb), channels (jsonb), enabled, createdAt`
- Condition examples:
  ```json
  { "incidentType": "ERROR_BURST", "minSeverity": "HIGH" }
  { "streamId": "api-prod", "anyIncident": true }
  { "incidentType": "LATENCY_DEGRADATION", "minSeverity": "MEDIUM" }
  ```

### Alert Rule CRUD Endpoints (JWT auth):
- `POST /alerts/rules` — create rule
- `GET /alerts/rules` — list for project
- `PUT /alerts/rules/:id` — update
- `DELETE /alerts/rules/:id` — delete
- `POST /alerts/rules/:id/test` — send a test notification

### Kafka Consumer:
Consume `pulseai.incidents.created`:
1. Load all enabled rules for the project
2. Evaluate each rule condition against the incident
3. For matching rules: send notifications to configured channels

### Notification Channels:

**Slack:** POST to `webhookUrl` with:
```json
{
  "text": "🚨 *{{ severity }}* incident on *{{ streamId }}*",
  "attachments": [{
    "color": "#FF0000",
    "fields": [
      { "title": "Type", "value": "{{ incidentType }}", "short": true },
      { "title": "Detected", "value": "{{ detectedAt }}", "short": true },
      { "title": "Root Cause", "value": "{{ diagnosis.rootCauseSummary }}" }
    ]
  }]
}
```

**Email:** via SendGrid API (if `SENDGRID_API_KEY` configured), HTML template with incident summary.

**Webhook:** POST to user-configured URL with full incident + diagnosis JSON payload.

### Alert History:
- Log every notification attempt: `{ ruleId, incidentId, channel, status: success|failed, sentAt, error? }`
- `GET /alerts/history` endpoint — last 100 alert deliveries for the project

---

## PART B: API Service (`services/api-service`)

This is the main REST API consumed by the frontend (JWT auth).

### Endpoints:

**Projects:**
- `POST /projects`, `GET /projects`, `GET /projects/:id`, `DELETE /projects/:id`
- `POST /projects/:id/api-keys` — generate new API key (return once, never again)
- `DELETE /projects/:id/api-keys/:keyId` — revoke key

**Streams:**
- `GET /projects/:id/streams` — list streams with last signal time, signal count today
- `GET /streams/:id/stats` — error rate, latency P95, signal volume (last 1h, 24h)

**Signals (query interface):**
- `GET /signals` — query signals with filters: `streamId, type, level, startTime, endTime, search (full-text on message), traceId`
- Pagination: cursor-based (last `signal_id + timestamp`)
- Max time range: 7 days, max results per page: 200
- Query against TimescaleDB

**Incidents:**
- `GET /incidents` — list with filters: status, severity, streamId, startTime
- `GET /incidents/:id` — full detail including diagnosis
- `PATCH /incidents/:id` — update status: `{ status: "RESOLVED" | "IGNORED" }`
- `GET /incidents/:id/signals` — signals from the detection window

**Analytics:**
- `GET /analytics/error-rate` — `{ streamId, interval: "1h|24h|7d" }` → time-series data
- `GET /analytics/latency` — P50/P95/P99 trend for a stream
- `GET /analytics/incident-summary` — incidents by severity, type, resolution time stats

### WebSocket (Socket.io):
- On new incident (`pulseai.incidents.created` consumed): broadcast to `project:<projectId>` room
- On incident update (diagnosis ready): broadcast update
- Frontend subscribes to project room after login

## Constraints for both services:
- Alert notification delivery must be idempotent (use Redis `SET NX` per `ruleId:incidentId` to prevent duplicate sends)
- API service signal queries must use TimescaleDB time_bucket for analytics — never scan raw rows for aggregation
- Write unit tests for alert rule condition evaluator
```

---

## PHASE 5 — Frontend Dashboard (Next.js 15)

```
## Context
Refer to CLAUDE.md. This phase builds the `frontend/` Next.js 15 app. It connects to api-service via REST (TanStack Query) and WebSocket (Socket.io). This is a developer-facing tool — prioritize information density over decoration.

## Tech stack: Next.js 15 App Router, TypeScript strict, Tailwind + shadcn/ui, TanStack Query v5, Zustand, Recharts, Socket.io client.

## Design philosophy: Dense, dark-mode-first, information-rich. Think Datadog meets Linear — not a marketing site.

## Pages:

### `/` — Landing page
- Dark hero: "Your AI SRE, always watching"
- 3 features: Ingest → Detect → Diagnose
- Live global stats: signals ingested today, incidents resolved

### Auth: `/login`, `/register`

### `/dashboard` — Project Overview
- Signal volume chart (last 24h, by type: log/metric/trace, stacked area chart)
- Active incidents panel (red banner if CRITICAL exists)
- Stream health grid: each stream as a card with color-coded status (green/yellow/red based on recent error rate)
- Recent incidents list

### `/streams/[id]` — Stream Detail
- **Log Explorer** (most important view):
  - Virtual scrolling log list (use `react-virtual`) — must handle 10,000 entries without lag
  - Each row: timestamp, level badge (colored), message, expandable attributes panel
  - Filter bar: level selector, text search, time range picker
  - Live tail toggle: auto-scroll to newest (poll every 3s when enabled)
- **Metrics tab:** line charts for each metric name over time
- **Traces tab:** trace list with duration bars, click to expand span tree
- Stream stats sidebar: error rate gauge, P95 latency, signal rate

### `/incidents` — Incident List
- Table with: severity badge, type, stream name, detected time, status, duration, "View" button
- Filter: status, severity, stream, time range
- Sort: detected time (default), severity, duration

### `/incidents/[id]` — Incident Detail (Key page)
- Status banner: OPEN (red pulse) / INVESTIGATING / RESOLVED
- Incident metadata: type, stream, detected at, trigger value vs threshold
- **AI Diagnosis panel** (center stage):
  - Root cause summary (large, prominent)
  - Confidence badge (HIGH/MEDIUM/LOW)
  - Expandable sections: Contributing Factors, Immediate Actions, Investigation Steps, Prevention
  - "Regenerate Diagnosis" button (with 5-min cooldown shown)
  - Feedback buttons: 👍 Helpful / 👎 Not helpful
- Evidence timeline: signals from the detection window in a mini log explorer
- "Mark Resolved" / "Ignore" action buttons

### `/alerts` — Alert Rules
- List of rules with enable/disable toggle
- "New Rule" form: select condition type, set thresholds, configure channels (Slack webhook URL, email)
- Alert delivery history table

### `/settings` — Project Settings
- API keys management: list, generate, revoke (show key once on generate)
- Project name, retention settings

## Key components:

**LogRow (virtual list item):**
- Level-colored left border (DEBUG=gray, INFO=blue, WARN=yellow, ERROR=red, FATAL=purple)
- Click to expand: show all attributes as key-value pairs, copy button
- If `traceId` present: link to trace view

**DiagnosisPanelLoading:**
- Skeleton with animated pulse while diagnosis generates
- "AI is analyzing..." with elapsed time counter

**IncidentSeverityBadge:**
- CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=gray
- With pulsing dot for OPEN incidents

**StreamHealthCard:**
- Mini sparkline of error rate (last 1h)
- Status color based on: green (<1% errors), yellow (1-5%), red (>5%)

## Constraints:
- Dark mode is the default and primary mode (not a toggle afterthought)
- Log explorer virtual list must render 10,000 rows without jank — use `@tanstack/react-virtual`
- WebSocket events update incident list in real-time without full page refetch
- All time displays must show relative time ("3 min ago") with absolute on hover
- Signal query results must be paginated — never load more than 200 rows at once
```

---

## PHASE 6 — Integration, SDK & README

```
## Context
Refer to CLAUDE.md. All services built. This final phase adds the ingest SDK, multi-stage Docker builds, E2E test, and documentation.

## Your task:

### 1. PulseAI Ingest SDK (`sdk/` folder)
A TypeScript SDK that developers install in their applications to send signals:

```typescript
import { PulseAI } from '@pulseai/sdk';

const pulse = new PulseAI({
  apiKey: process.env.PULSEAI_API_KEY,
  streamId: 'my-api-service',
  endpoint: 'https://your-pulseai-instance.com'
});

// Log ingestion
pulse.log('error', 'Database connection failed', { host: 'db-1', retryCount: 3 });

// Metric ingestion
pulse.metric('response_time_ms', 245, 'ms', { endpoint: '/api/users' });

// Trace ingestion
pulse.trace({
  traceId: 'abc123',
  spanId: 'span1',
  operationName: 'GET /api/users',
  durationMs: 245,
  status: 'OK'
});

// Auto-flush every 5 seconds or when buffer reaches 100 signals
```

SDK features:
- **Buffered sending:** collect signals in memory, flush every 5s or when buffer hits 100
- **Retry logic:** exponential backoff (3 retries) on network failure
- **Winston transport:** `pulse.winstonTransport()` — plug into existing Winston logger
- **Express middleware:** `pulse.expressMiddleware()` — auto-trace all HTTP requests
- `sdk/README.md` with 5-minute quickstart for Node.js apps

### 2. Docker — Multi-stage Builds
Same pattern as VibeGuard and AgentWeave. Add a `docker-compose.ingest-only.yml` for teams that only want the ingest pipeline without the diagnosis features.

### 3. E2E Test (`e2e/happy-path.test.ts`)
1. Register user, create project, generate API key
2. Send 200 log signals with 25% ERROR rate via ingest gateway (simulate error burst)
3. Wait up to 30s for an incident to be created (poll `GET /incidents`)
4. Assert incident type is `ERROR_BURST`
5. Wait up to 60s for diagnosis to be generated (poll `GET /incidents/:id`, check `diagnosisReady`)
6. Assert diagnosis has `rootCauseSummary`, `immediateActions` (non-empty), `confidence` is not null
7. Mark incident as RESOLVED via API
8. Assert incident status updates to RESOLVED

### 4. README.md
Sections:
- **What is PulseAI** — "Observability tools show you data. PulseAI tells you what it means."
- **Architecture diagram** (ASCII) — show signal flow: SDK → Ingest → Kafka → Stream Processor → Diagnosis → Frontend
- **Core concepts** glossary
- **Getting Started** — docker compose up, install SDK, send first signals, see first incident
- **SDK Quickstart** — link to `sdk/README.md`
- **Self-hosted vs Managed** — note that this is fully self-hostable (good for OSS community)
- **Supported LLM Providers** — table: Anthropic Claude (recommended), OpenAI GPT-4, Ollama (self-hosted)
- **API Reference** — link to Swagger
- **Roadmap** — GitHub Actions integration (auto-ingest CI logs), Kubernetes metrics adapter, Slack App

### 5. GitHub Actions CI
- NestJS matrix tests for all 4 NestJS services
- Maven test for stream-processor
- SDK build + type check + unit tests
- E2E test as final dependent job
```

---

## 📎 Persistent CLAUDE.md Reminder

> At the start of **every phase**, prepend this to your agent prompt:

```
Before starting, read the CLAUDE.md file at the root of this repository.
All naming conventions, Signal schema, Kafka topic patterns, port assignments,
TimescaleDB schema decisions, and architectural decisions are defined there.
The Signal schema in CLAUDE.md is the single source of truth — all services must use it exactly.
```

---

*Generated for PulseAI project — May 2026*
