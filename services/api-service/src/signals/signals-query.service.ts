import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Signal } from '../entities/signal.entity';

@Injectable()
export class SignalsQueryService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async findSignals(
    projectId: string,
    query: {
      limit?: number;
      cursor?: string;
      streamId?: string;
      type?: string;
      level?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const limit = Math.min(query.limit || 50, 100);
    let cursorData: { timestamp: string; signalId: string } | null = null;

    if (query.cursor) {
      try {
        cursorData = JSON.parse(Buffer.from(query.cursor, 'base64').toString('utf8'));
      } catch (err) {
        console.warn('Invalid cursor passed, ignoring cursor');
      }
    }

    let sql = `
      SELECT * FROM signals 
      WHERE project_id = $1
    `;
    const params: any[] = [projectId];
    let paramIndex = 2;

    if (query.streamId) {
      sql += ` AND stream_id = $${paramIndex++}`;
      params.push(query.streamId);
    }
    if (query.type) {
      sql += ` AND type = $${paramIndex++}`;
      params.push(query.type.toUpperCase());
    }
    if (query.level) {
      sql += ` AND level = $${paramIndex++}`;
      params.push(query.level.toUpperCase());
    }
    if (query.startDate) {
      sql += ` AND timestamp >= $${paramIndex++}`;
      params.push(new Date(query.startDate));
    }
    if (query.endDate) {
      sql += ` AND timestamp <= $${paramIndex++}`;
      params.push(new Date(query.endDate));
    }

    if (cursorData) {
      sql += ` AND (timestamp < $${paramIndex} OR (timestamp = $${paramIndex} AND signal_id < $${paramIndex + 1}))`;
      params.push(new Date(cursorData.timestamp), cursorData.signalId);
      paramIndex += 2;
    }

    sql += ` ORDER BY timestamp DESC, signal_id DESC LIMIT $${paramIndex}`;
    params.push(limit + 1); // Get one extra to determine next page cursor

    const results: any[] = await this.entityManager.query(sql, params);

    const hasMore = results.length > limit;
    const signals = hasMore ? results.slice(0, limit) : results;

    let nextCursor: string | null = null;
    if (hasMore && signals.length > 0) {
      const lastSignal = signals[signals.length - 1];
      const cursorObj = {
        timestamp: lastSignal.timestamp,
        signalId: lastSignal.signal_id,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');
    }

    return {
      signals: signals.map((s) => ({
        signalId: s.signal_id,
        timestamp: s.timestamp,
        projectId: s.project_id,
        streamId: s.stream_id,
        type: s.type,
        receivedAt: s.received_at,
        level: s.level,
        message: s.message,
        metricName: s.metric_name,
        metricValue: s.metric_value,
        metricUnit: s.metric_unit,
        traceId: s.trace_id,
        spanId: s.span_id,
        parentSpanId: s.parent_span_id,
        operationName: s.operation_name,
        durationMs: s.duration_ms,
        status: s.status,
        attributes: s.attributes,
      })),
      nextCursor,
    };
  }

  async getLatencyAnalytics(projectId: string, startDate: Date, endDate: Date) {
    // Queries TimescaleDB aggregate using time_bucket
    const sql = `
      SELECT 
        time_bucket('5 minutes', timestamp) AS bucket,
        AVG(duration_ms::double precision) AS avg_latency,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms::double precision) AS p95_latency,
        percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms::double precision) AS p99_latency
      FROM signals
      WHERE project_id = $1 
        AND type = 'TRACE'
        AND timestamp >= $2
        AND timestamp <= $3
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const results = await this.entityManager.query(sql, [projectId, startDate, endDate]);
    return results.map((row) => ({
      bucket: row.bucket,
      avgLatency: parseFloat(row.avg_latency) || 0,
      p95Latency: parseFloat(row.p95_latency) || 0,
      p99Latency: parseFloat(row.p99_latency) || 0,
    }));
  }

  async getErrorAnalytics(projectId: string, startDate: Date, endDate: Date) {
    // Queries TimescaleDB aggregate using time_bucket
    const sql = `
      SELECT 
        time_bucket('5 minutes', timestamp) AS bucket,
        COUNT(*) FILTER (WHERE (type = 'LOG' AND level IN ('ERROR', 'FATAL')) OR (type = 'TRACE' AND status = 'ERROR'))::int AS error_count,
        COUNT(*)::int AS total_count
      FROM signals
      WHERE project_id = $1
        AND timestamp >= $2
        AND timestamp <= $3
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const results = await this.entityManager.query(sql, [projectId, startDate, endDate]);
    return results.map((row) => ({
      bucket: row.bucket,
      errorCount: row.error_count || 0,
      totalCount: row.total_count || 0,
      errorRate: row.total_count ? (row.error_count / row.total_count) * 100 : 0,
    }));
  }
}
