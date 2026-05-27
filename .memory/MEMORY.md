# PulseAI Project Memory Bank

This file maintains project context and state across agent sessions, acting as the memory store to optimize token usage and avoid context amnesia.

---

## Current Status
- **Phase:** Phase 6 (Ingestion SDK & Documentation) - COMPLETED
- **Active Task:** Verification walkthrough complete, monorepo fully active.
- **Last Updated:** 2026-05-27T16:00:00Z (All Phases Completed)

---

## Architectural Decisions
1.  **Monorepo:** Configured as a pnpm monorepo using workspace packages under `services/*`, `frontend`, and `sdk`.
2.  **Telemetry Data Schema:** Locked down the schemas for `LOG`, `METRIC`, and `TRACE` in `CLAUDE.md`. All services must adhere to this.
3.  **Port Mapping:** Confirmed standard ports to prevent port conflicts:
    *   Ingest Gateway = 3000
    *   Stream Processor = 8080
    *   Diagnosis Service = 3001
    *   Alert Service = 3002
    *   API Service = 3003
    *   Frontend Dashboard = 4000
4.  **Database Integration:** Selected TimescaleDB PG16 for time-series signal storage, partition key `timestamp`, 7-day retention.
5.  **Custom SVG Charts:** Opted for custom SVG lines and bars inside Next.js 16 to avoid hydration, type, or styling mismatch conflicts with external chart wrappers.
6.  **Redis Idempotency Locks:** Idempotency checking for alerts uses `pulseai:alert-sent:<ruleId>:<incidentId>` in Redis (10-minute expiry NX) to ensure alerts are never duplicated.

---

## Fixed Issues & Lessons Learned
- **Typeorm ioredis set parameters:** `redis.set` signatures in TypeScript for ioredis require expiry arguments in strict order (`EX`, `time`, `NX`), otherwise it throws a parameter overload match error.
- **Ajv Type Guards:** For NestJS Ajv validation payload verification, JSON types are narrowed to `unknown`. Cast values explicitly (e.g. `(signal as any).timestamp`) to satisfy TS checks.

---

## Session History
### 2026-05-27 (Session 1 - Bootstrap)
- Created root configurations: `pnpm-workspace.yaml`, `package.json`, `.gitignore`, `.env.example`.
- Created Docker configurations: `docker-compose.yml`, `docker-compose.dev.yml`.
- Established agent workflow configurations: `CLAUDE.md`, `.memory/MEMORY.md`, `.skills/observability-skills.md`, `codegraph.config.json`, `.rtk.toml`.

### 2026-05-27 (Session 2 - Ingest Gateway)
- Implemented `services/ingest-gateway` fully.
- Set up API Key Authentication Guard with Redis cache (5m TTL).
- Set up sliding window Rate Limiter Guard with Redis Lua script (10,000 signals/min).
- Integrated Ajv validation schemas for LOG, METRIC, and TRACE signals.
- Configured KafkaJS Producer with fire-and-forget (acks: 0) publishing.
- Implemented Stream Tracker and 60-second Cron database flusher.
- Created `load-test.js` script and documented results in `LOAD_TEST.md`.
- Wrote Jest unit tests for ValidationService and verified successful test runs.

### 2026-05-27 (Session 3 - Stream Processor)
- Implemented `services/stream-processor` (Java Spring Boot) fully.
- Created Flyway migration `V1__create_signals_table.sql` setting up TimescaleDB hypertables, indexes, and retention policies.
- Set up composite primary key JPA mappings (`SignalId` + `SignalEntity` + `@JdbcTypeCode(SqlTypes.JSON)`).
- Implemented concurrent `@KafkaListener` consumers for logs, metrics, and traces.
- Created `StreamStats` tracking rolling sliding windows and a reservoir sampler for latency.
- Implemented anomaly detectors (error rate, error burst, metric standard deviation, trace failures, and silence).
- Created `WindowRecoveryService` to populate sliding windows from TimescaleDB at startup.
- Created `AutoResolutionService` to resolve incidents via Redis count locks after 3 checks.
- Wrote JUnit 5 tests covering detector thresholds and standard deviation spikes.

### 2026-05-27 (Session 4 - Diagnosis Service)
- Implemented `services/diagnosis-service` (NestJS) fully.
- Collected TimescaleDB evidence around 5-minute incident window.
- Scrubber clusters errors using regex and parses Java/Node stack traces.
- Built self-contained dynamic Circuit Breaker class (3 failures -> opens LLM connection).
- Handled playbooks auto-fallbacks on circuit breaker breach.
- Added re-diagnosis rate limit (5-minute cooldown Redis key).

### 2026-05-27 (Session 5 - Alert & API Services)
- Implemented `services/alert-service` (NestJS) for rules evaluation and notifier routing.
- Coded `ConditionEvaluator` supporting severity scales and stream/type filters.
- Built `NotifierService` carrying Slack Block Kit, SendGrid templates, and webhook posts.
- Implemented `services/api-service` (NestJS) query service running cursor-based pagination and raw SQL `time_bucket('5 minutes')` averages/percentiles.
- Programmed Socket.io gateway broadcasting real-time incidents to project rooms.

### 2026-05-27 (Session 6 - Frontend & SDK)
- Scaffolded dependencies in `frontend` (Next.js 16 + Tailwind CSS v4).
- Added `socket.ts` and custom SVG latency/error charts.
- Wrote `LoginView` and `DashboardView` coordinating drawer details, alert rule builders, and feedback loops.
- Programmed Winston Log Transport and Express middleware tracking in `packages/pulseai-sdk.ts`.
