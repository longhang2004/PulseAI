# PulseAI Project Memory Bank

This file maintains project context and state across agent sessions, acting as the memory store to optimize token usage and avoid context amnesia.

---

## Current Status
- **Phase:** Phase 2 (Stream Processor - Spring Boot) - COMPLETED
- **Active Task:** Handover for Phase 3 (Diagnosis Service - NestJS).
- **Last Updated:** 2026-05-27T08:50:00Z (Phase 2 Completed)

---

## Architectural Decisions
1.  **Monorepo:** Configured as a pnpm monorepo using workspace packages under `services/*`, `frontend`, and `sdk`.
2.  **Telemetry Data Schema:** Locked down the schemas for `LOG`, `METRIC`, and `TRACE` in `CLAUDE.md`. All services must adhere to this.
3.  **Port Mapping:** Confirmed standard ports to prevent port conflicts (Ingest = 3000, Stream Processor = 8080, Diagnosis = 3001, Alert = 3002, API = 3003, Frontend = 4000).
4.  **Database Integration:** Selected TimescaleDB PG16 for time-series signal storage, partition key `timestamp`, 7-day retention.
5.  **Java Spring Boot (Java 17 fallback):** System environment runs OpenJDK 17. Concurrency models in `stream-processor` will be adapted to be Java 17-compatible by default, but ready for Java 21 Virtual Threads when requested.

---

## Fixed Issues & Lessons Learned
- *No bugs or fixes recorded yet.*

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
