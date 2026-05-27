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
                                                 +---> Anthropic Claude / OpenAI / Ollama
                                                 |
                                                 v
                                         [ Alert Service ]  (Port 3002 - NestJS)
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
Start all the monorepo services and the Next.js frontend concurrently:
```bash
pnpm dev:services
```

#### Monorepo Port Reference:
*   **Ingest Gateway:** Port `3000` (NestJS Fastify)
*   **Stream Processor:** Port `8080` (Spring Boot Java)
*   **Diagnosis Service:** Port `3001` (NestJS) - AI processing
*   **Alert Service:** Port `3002` (NestJS) - Slack, email, webhook routing
*   **API Service:** Port `3003` (NestJS) - Query engine & WebSockets
*   **Frontend Dashboard:** Port `4000` (Next.js 16 / App Router / Tailwind CSS v4)

---

## PulseAI Integration SDK

Inject telemetry collection into your Node/Express applications using our lightweight integration client.

### Installation
Add the SDK to your server application dependencies:
```bash
npm install axios uuid
```

### Usage Example
Import and hook the SDK into Winston loggers and Express routes:

```typescript
import express from 'express';
import winston from 'winston';
import { PulseAISDK } from './packages/pulseai-sdk';

const app = express();

// 1. Initialize the SDK
const pulseAI = new PulseAISDK({
  apiKey: 'YOUR_PROJECT_API_KEY',
  streamId: 'api-service-production',
  ingestUrl: 'http://localhost:3000/ingest'
});

// 2. Register Winston logger transport
const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
    pulseAI.getWinstonTransport() // Redirects error/info logs to PulseAI Ingestion Gateway
  ]
});

// 3. Register Express trace middleware
app.use(pulseAI.getExpressMiddleware()); // Automatically traces request latency & routes

app.get('/api/users', (req, res) => {
  logger.info('Fetching user records');
  res.json([{ id: 1, name: 'Alice' }]);
});

app.listen(8081, () => {
  logger.info('App listening on port 8081');
});
```

---

## Supported LLM Providers

You can select the LLM provider by setting `LLM_PROVIDER` in your environment. You can also customize the model name for any provider using environment overrides:

| Provider | Env Provider Select | Config API Key / URL | Default Model | Model Override Env |
|---|---|---|---|---|
| **Anthropic** | `LLM_PROVIDER=anthropic` | `ANTHROPIC_API_KEY` | `claude-3-5-sonnet-20241022` | `ANTHROPIC_MODEL` |
| **OpenAI** | `LLM_PROVIDER=openai` | `OPENAI_API_KEY` | `gpt-4o` | `OPENAI_MODEL` |
| **Gemini** | `LLM_PROVIDER=gemini` | `GEMINI_API_KEY` | `gemini-1.5-flash` | `GEMINI_MODEL` |
| **Ollama** | `LLM_PROVIDER=ollama` | `OLLAMA_ENDPOINT` | `llama3` | `OLLAMA_MODEL` |

### Gemini Example (Gemini 2.5 Flash)
```bash
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```
