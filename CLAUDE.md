# PulseAI — AI Agent Developer Guidelines (CLAUDE.md)

## Project Overview & Differentiation
**PulseAI** is a production observability platform that ingests logs, traces, and metrics, analyzes them in real-time, and generates human-readable incident reports and root-cause hypotheses automatically.
*   **Key Differentiation:** Observability tools show you the data. PulseAI tells you what it means and what to do. The gap is the AI diagnosis layer on top of raw telemetry.

---

## Core Concepts Glossary
*   **Signal:** A single unit of telemetry (a log line, trace span, or metric data point).
*   **Stream:** A named, continuous channel of signals from a single service (e.g. `api-gateway-prod`).
*   **Incident:** An automatically detected anomaly or degradation event with a lifecycle: `OPEN` → `INVESTIGATING` → `RESOLVED` | `IGNORED`.
*   **Diagnosis:** An AI-generated analysis of an incident: root cause hypothesis, severity, recommended actions.
*   **Alert Rule:** A user-defined condition that triggers an incident (e.g. error rate > 5% for 60s).

---

## Signal Schemas (Single Source of Truth)

All services must parse, ingest, process, and query telemetry exactly according to these schemas:

### 1. Log Signal
```json
{
  "type": "LOG",
  "streamId": "string",
  "timestamp": "ISO-8601 string",
  "level": "DEBUG|INFO|WARN|ERROR|FATAL",
  "message": "string",
  "attributes": "object",
  "traceId": "string (optional)"
}
```

### 2. Metric Signal
```json
{
  "type": "METRIC",
  "streamId": "string",
  "timestamp": "ISO-8601 string",
  "name": "string",
  "value": "number",
  "unit": "string",
  "tags": "object"
}
```

### 3. Trace Signal
```json
{
  "type": "TRACE",
  "streamId": "string",
  "timestamp": "ISO-8601 string",
  "traceId": "string",
  "spanId": "string",
  "parentSpanId": "string (optional)",
  "operationName": "string",
  "durationMs": "number",
  "status": "OK|ERROR",
  "attributes": "object"
}
```

---

## Architectural & Integration Standards

*   **Ports:**
    *   `ingest-gateway`: `3000` (NestJS with Fastify)
    *   `stream-processor`: `8080` (Java Spring Boot)
    *   `diagnosis-service`: `3001` (NestJS)
    *   `alert-service`: `3002` (NestJS)
    *   `api-service`: `3003` (NestJS)
    *   `frontend`: `4000` (Next.js 15, maps internally to 3000)
    *   `timescaledb`: `5432`
    *   `redis`: `6379`
    *   `kafka`: `9092`
    *   `kafka-ui`: `8090`
*   **Kafka Topics:**
    *   Signals: `pulseai.signals.<type>` (e.g., `pulseai.signals.log`, `pulseai.signals.metric`, `pulseai.signals.trace`)
    *   Incidents: `pulseai.incidents.created`, `pulseai.incidents.updated`, `pulseai.incidents.resolved`
    *   Alerts: `pulseai.alerts.sent`
*   **TimescaleDB Hypertable:**
    *   Stored in `signals` hypertable, partitioned by `timestamp` column.
    *   Retention policy: 7 days (`add_retention_policy('signals', INTERVAL '7 days')`).
*   **Docker Network:** `pulseai-net`
*   **Standard API Response Format:**
    ```json
    {
      "success": true,
      "data": {},
      "error": null,
      "meta": {}
    }
    ```

---

## Agent Behavior Principles (Andrej Karpathy Skills)

Whenever editing code or executing commands in this repository, you **MUST** adhere to:

1.  **Think Before Coding:**
    *   Always state assumptions and clarify ambiguity in the implementation plan before touching code.
    *   Read the project context and trace dependencies before adding components.
2.  **Simplicity First:**
    *   Write the absolute minimum code needed to solve the problem.
    *   Avoid creating excessive abstractions, interfaces, or generic helper functions.
3.  **Surgical Changes:**
    *   Only modify code directly related to the current task.
    *   Avoid unrelated styling, refactoring, or sweeping cleanups.
4.  **Goal-Driven Execution:**
    *   Establish clear success criteria (preferably via unit/E2E tests) and verify them after every change.
5.  **Session Memory:**
    *   Before ending a turn or session, record important insights, bugs fixed, and architectural choices to [.memory/MEMORY.md](file:///Users/longhang/personal_repos/PulseAI/.memory/MEMORY.md).

---

## Standard Developer Commands

### Bootstrapping & Dependencies
*   Install workspaces: `pnpm install`

### Local Execution (Concurrency via Root)
*   Start Infrastructure (Docker): `pnpm dev:infra`
*   Start Local Dev Services: `pnpm dev:services`
*   Build Workspace: `pnpm build`
*   Run All Tests: `pnpm test`

### Running Individual Services
*   Ingest Gateway: `pnpm --filter ingest-gateway run dev`
*   Stream Processor: `mvn -pl services/stream-processor spring-boot:run` (or use active profile `dev`)
*   Diagnosis Service: `pnpm --filter diagnosis-service run dev`
*   Alert Service: `pnpm --filter alert-service run dev`
*   API Service: `pnpm --filter api-service run dev`
*   Frontend: `pnpm --filter frontend run dev`
