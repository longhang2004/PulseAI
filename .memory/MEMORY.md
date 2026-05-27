# PulseAI Project Memory Bank

This file maintains project context and state across agent sessions, acting as the memory store to optimize token usage and avoid context amnesia.

---

## Current Status
- **Phase:** Phase 1 (Ingest Gateway Implementation) - COMPLETED
- **Active Task:** Handover for Phase 2 (Stream Processor - Spring Boot).
- **Last Updated:** 2026-05-27T08:44:00Z (Phase 1 Completed)

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
