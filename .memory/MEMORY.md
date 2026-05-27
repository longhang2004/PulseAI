# PulseAI Project Memory Bank

This file maintains project context and state across agent sessions, acting as the memory store to optimize token usage and avoid context amnesia.

---

## Current Status
- **Phase:** Phase 0 (Project Bootstrap & Scaffolding) - COMPLETED
- **Active Task:** Handover for Phase 1 (Ingest Gateway implementation).
- **Last Updated:** 2026-05-27T08:34:00Z (Bootstrap Completed)

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
