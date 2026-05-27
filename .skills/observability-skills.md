# Skill: PulseAI Observability & SRE Operations

A playbook for agents and developers to debug, verify, and interact with the PulseAI telemetry gateway and stream processor.

---

## 1. Verifying Infrastructure Health
Verify that all core databases and message brokers are running and responsive:

```bash
# Check Docker containers
docker compose ps

# Test TimescaleDB Connection
docker exec -it pulseai-timescaledb pg_isready -U postgres -d pulseai

# Test Redis Connection
docker exec -it pulseai-redis redis-cli ping

# Verify Kafka Topics
docker exec -it pulseai-kafka kafka-topics --bootstrap-server localhost:9092 --list
```

---

## 2. Ingesting Dummy Telemetry
Send synthetic logs, metrics, or traces to test the `ingest-gateway` (on port 3000):

```bash
# 1. Ingest log signal
curl -X POST http://localhost:3000/ingest/log \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key" \
  -d '{
    "streamId": "test-service",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "level": "ERROR",
    "message": "Database query timed out after 5000ms",
    "attributes": { "query": "SELECT * FROM users", "timeout": 5000 }
  }'

# 2. Ingest metric signal
curl -X POST http://localhost:3000/ingest/metric \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key" \
  -d '{
    "streamId": "test-service",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "name": "http_response_time",
    "value": 156.4,
    "unit": "ms",
    "tags": { "path": "/api/users", "method": "GET" }
  }'
```

---

## 3. Querying TimescaleDB Signals
Inspect raw telemetry records directly from TimescaleDB:

```bash
# Query recent logs
docker exec -it pulseai-timescaledb psql -U postgres -d pulseai -c \
  "SELECT timestamp, stream_id, level, message FROM signals WHERE type = 'LOG' ORDER BY timestamp DESC LIMIT 10;"

# Query 1-minute bucketed aggregates
docker exec -it pulseai-timescaledb psql -U postgres -d pulseai -c \
  "SELECT time_bucket('1 minute', timestamp) AS bucket, COUNT(*) FROM signals GROUP BY bucket ORDER BY bucket DESC LIMIT 10;"
```

---

## 4. Resetting Environment
Flush local state and clean docker volumes for a fresh test run:

```bash
# Stop containers and destroy volumes
docker compose down -v

# Clear local cache/node_modules
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
find . -name "target" -type d -prune -exec rm -rf '{}' +
```
