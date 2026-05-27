# PulseAI — Production Observability with AI-Powered Diagnosis

> **Observability tools show you the data. PulseAI tells you what it means.**

PulseAI is an open-source, production observability platform that ingests logs, traces, and metrics from running applications. It analyzes patterns and anomalies in real-time and leverages AI to generate human-readable incident reports and root-cause hypotheses automatically — saving developers hours of manual troubleshooting.

---

## Architecture Diagram

```text
               +-------------------------------------------+
               |              Application / SDK            |
               +-------------------------------------------+
                     /               |               \
             Logs   /        Metrics |        Traces  \
                   v                 v                 v
            +--------------+  +--------------+  +--------------+
            | Ingest (LOG) |  |Ingest(METRIC)|  |Ingest(TRACE) |
            +--------------+  +--------------+  +--------------+
                                     |
                                     v
                             [ Ingest Gateway ]  (Port 3000 - NestJS/Fastify)
                                     |
                                     v
                              [ Kafka Broker ]   (Port 9092)
                                     |
                                     v
                            [ Stream Processor ]  (Port 8080 - Java Spring Boot)
                            /                  \
              Persist      /                    \  Anomaly Detected
                          v                      v
                  [ TimescaleDB ]          [ Postgres (JPA) ]
                    (Port 5432)             - Create Incident
                                                 |
                                                 v
                                        [ Diagnosis Service ]  (Port 3001 - NestJS)
                                                 |
                                                 +---> Anthropic Claude / OpenAI
                                                 |
                                                 v
                                         [ API Service ]  (Port 3003 - NestJS)
                                                 |
                                                 v
                                        [ Next.js Frontend ] (Port 4000)
```

---

## Core Concepts
*   **Signal:** A single unit of telemetry (a log line, trace span, or metric data point).
*   **Stream:** A named, continuous channel of signals from a single service (e.g., `api-gateway-prod`).
*   **Incident:** An automatically detected anomaly or degradation event with a lifecycle (`OPEN` → `INVESTIGATING` → `RESOLVED`).
*   **Diagnosis:** An AI-generated analysis of an incident: root cause hypothesis, severity, and recommended actions.
*   **Alert Rule:** A user-defined condition that triggers an incident (e.g., error rate > 5% for 60s).

---

## Getting Started

### Prerequisites
*   Node.js (v22+) & `pnpm`
*   Java JDK 17
*   Docker & Docker Compose

### 1. Run Infrastructure
Spin up the required TimescaleDB, Redis, and Kafka infrastructure:
```bash
pnpm dev:infra
```

### 2. Run Application Services
Start the Node services and Next.js frontend concurrently:
```bash
pnpm dev:services
```
Alternatively, start individual services locally or compile them using the workspace filters:
*   Ingest Gateway: `pnpm --filter ingest-gateway run dev` (Port 3000)
*   Stream Processor: `mvn -pl services/stream-processor spring-boot:run` (Port 8080)
*   Diagnosis Service: `pnpm --filter diagnosis-service run dev` (Port 3001)
*   Alert Service: `pnpm --filter alert-service run dev` (Port 3002)
*   API Service: `pnpm --filter api-service run dev` (Port 3003)
*   Frontend: `pnpm --filter frontend run dev` (Port 4000)

---

## Supported LLM Providers

| Provider | Model (Recommended) | Configuration | Self-Hostable |
|---|---|---|---|
| **Anthropic** | `claude-3-5-sonnet` | `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` | No |
| **OpenAI** | `gpt-4o` | `LLM_PROVIDER=openai`, `OPENAI_API_KEY` | No |
| **Ollama** | `llama3:8b` | `LLM_PROVIDER=ollama`, `OLLAMA_ENDPOINT` | Yes |

---

## Roadmap
1.  **GitHub Actions Integration:** Auto-ingest CI/CD logs to diagnose build failures.
2.  **Kubernetes Operator:** Native metrics/events adapter.
3.  **Slack App:** Native interactive alerts with inline re-diagnose actions.
