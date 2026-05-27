-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create Signals Table
CREATE TABLE signals (
  signal_id UUID NOT NULL,
  project_id UUID NOT NULL,
  stream_id TEXT NOT NULL,
  type TEXT NOT NULL,                  -- LOG | METRIC | TRACE
  timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  level TEXT,                          -- for LOG
  message TEXT,                        -- for LOG
  metric_name TEXT,                    -- for METRIC
  metric_value DOUBLE PRECISION,       -- for METRIC
  metric_unit TEXT,                    -- for METRIC
  trace_id TEXT,                       -- for TRACE
  span_id TEXT,                        -- for TRACE
  duration_ms BIGINT,                  -- for TRACE
  status TEXT,                         -- for TRACE
  operation_name TEXT,                 -- for TRACE
  attributes JSONB,
  PRIMARY KEY (signal_id, timestamp)
);

-- Convert to Hypertable partitioned by 'timestamp'
SELECT create_hypertable('signals', 'timestamp');

-- Create Ingest Indexes
CREATE INDEX ON signals (stream_id, timestamp DESC);
CREATE INDEX ON signals (project_id, type, timestamp DESC);

-- Create Incidents Metadata Table
CREATE TABLE incidents (
  id UUID NOT NULL PRIMARY KEY,
  project_id UUID NOT NULL,
  stream_id TEXT NOT NULL,
  type TEXT NOT NULL,                  -- ERROR_BURST | LATENCY_DEGRADATION | etc.
  severity TEXT NOT NULL,              -- LOW | MEDIUM | HIGH | CRITICAL
  status TEXT NOT NULL,                -- OPEN | INVESTIGATING | RESOLVED | IGNORED
  title TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  trigger_value DOUBLE PRECISION NOT NULL,
  trigger_threshold DOUBLE PRECISION NOT NULL,
  signal_window_start TIMESTAMPTZ,
  signal_window_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ON incidents (project_id, status);
CREATE INDEX ON incidents (stream_id, status);

-- Add retention policy on signals: 7 days
SELECT add_retention_policy('signals', INTERVAL '7 days');
