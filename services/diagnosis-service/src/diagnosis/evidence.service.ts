import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Signal } from '../entities/signal.entity';
import { Incident } from '../entities/incident.entity';

@Injectable()
export class EvidenceService {
  constructor(
    @InjectRepository(Signal)
    private readonly signalRepository: Repository<Signal>
  ) {}

  async collectEvidence(incident: Incident): Promise<any> {
    const detectedAt = new Date(incident.detectedAt);
    
    // 5-minute window around incident detection (+/- 2.5 minutes)
    const startTime = new Date(detectedAt.getTime() - 2.5 * 60 * 1000);
    const endTime = new Date(detectedAt.getTime() + 2.5 * 60 * 1000);

    // 1-hour baseline window before the incident detection
    const baselineStartTime = new Date(startTime.getTime() - 60 * 60 * 1000);
    const baselineEndTime = startTime;

    // 1. Fetch last 100 ERROR/FATAL logs
    const errorLogs = await this.signalRepository.find({
      where: {
        projectId: incident.projectId,
        streamId: incident.streamId,
        type: 'LOG',
        level: In(['ERROR', 'FATAL']),
        timestamp: Between(startTime, endTime),
      },
      order: { timestamp: 'DESC' },
      take: 100,
    });

    const errorLogMessages = errorLogs.map((log) => log.message || '');

    // 2. Fetch last 200 logs for pattern clustering
    const allLogsWindow = await this.signalRepository.find({
      where: {
        projectId: incident.projectId,
        streamId: incident.streamId,
        type: 'LOG',
        timestamp: Between(startTime, endTime),
      },
      order: { timestamp: 'DESC' },
      take: 200,
    });

    const topPatterns = this.extractLogPatterns(allLogsWindow.map((l) => l.message || ''));

    // 3. Extract Stack Traces from log messages
    const stackTraces = this.extractStackTraces(allLogsWindow.map((l) => l.message || ''));

    // 4. Trace Latency Calculation (Current vs Baseline)
    const currentTraces = await this.signalRepository.find({
      where: {
        projectId: incident.projectId,
        streamId: incident.streamId,
        type: 'TRACE',
        timestamp: Between(startTime, endTime),
      },
      select: ['durationMs'],
    });

    const baselineTraces = await this.signalRepository.find({
      where: {
        projectId: incident.projectId,
        streamId: incident.streamId,
        type: 'TRACE',
        timestamp: Between(baselineStartTime, baselineEndTime),
      },
      select: ['durationMs'],
      take: 1000, // Cap baseline to prevent memory blowups
    });

    const latencyCurrent = this.calculatePercentiles(currentTraces.map((t) => Number(t.durationMs || 0)));
    const latencyBaseline = this.calculatePercentiles(baselineTraces.map((t) => Number(t.durationMs || 0)));

    // 5. Metric Spike Detection
    const currentMetrics = await this.signalRepository.find({
      where: {
        projectId: incident.projectId,
        streamId: incident.streamId,
        type: 'METRIC',
        timestamp: Between(startTime, endTime),
      },
    });

    const metricSpikes = await this.calculateMetricSpikes(incident.projectId, incident.streamId, currentMetrics, baselineStartTime, baselineEndTime);

    return {
      errorLogs: errorLogMessages.slice(0, 20), // Top 20 for prompt size constraints
      topPatterns,
      stackTraces,
      latencyBaseline,
      latencyCurrent,
      metricSpikes,
    };
  }

  /**
   * Normalize messages and count frequencies to extract top 5 patterns.
   */
  private extractLogPatterns(messages: string[]): { pattern: string; count: number }[] {
    const patterns: Map<string, number> = new Map();

    for (const msg of messages) {
      // 1. Replace UUIDs
      let normalized = msg.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '[UUID]');
      // 2. Replace Numbers
      normalized = normalized.replace(/\b\d+\b/g, '[NUM]');
      // 3. Replace paths/URIs
      normalized = normalized.replace(/\/([a-zA-Z0-9_.-]+\/?)+/g, '[PATH]');

      patterns.set(normalized, (patterns.get(normalized) || 0) + 1);
    }

    return Array.from(patterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Extract stack traces from log lines.
   */
  private extractStackTraces(messages: string[]): string[] {
    const stackTraces: string[] = [];
    
    for (const msg of messages) {
      if (msg.includes('\tat ') || msg.includes('Caused by:') || msg.includes('Stacktrace:')) {
        // Truncate stack trace to first 10 lines to save tokens
        const truncated = msg.split('\n').slice(0, 10).join('\n');
        stackTraces.push(truncated);
        if (stackTraces.length >= 3) break;
      }
    }
    return stackTraces;
  }

  private calculatePercentiles(durations: number[]): { p50: number; p95: number; p99: number } {
    if (durations.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    durations.sort((a, b) => a - b);
    const size = durations.length;

    return {
      p50: durations[Math.floor(size * 0.50)] || 0,
      p95: durations[Math.floor(size * 0.95)] || 0,
      p99: durations[Math.floor(size * 0.99)] || 0,
    };
  }

  private async calculateMetricSpikes(
    projectId: string,
    streamId: string,
    currentMetrics: Signal[],
    baselineStart: Date,
    baselineEnd: Date
  ): Promise<{ name: string; baseline: number; current: number }[]> {
    const spikes: { name: string; baseline: number; current: number }[] = [];
    const metricNames = Array.from(new Set(currentMetrics.map((m) => m.metricName).filter(Boolean)));

    for (const name of metricNames) {
      // Find average baseline value for this metric in the previous hour
      const baselineRecords = await this.signalRepository.find({
        where: {
          projectId,
          streamId,
          type: 'METRIC',
          metricName: name,
          timestamp: Between(baselineStart, baselineEnd),
        },
        select: ['metricValue'],
      });

      if (baselineRecords.length === 0) continue;

      const values = baselineRecords.map((r) => Number(r.metricValue || 0));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      
      const sumSquareDiffs = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
      const stdDev = Math.sqrt(sumSquareDiffs / values.length) || 0.00001;

      // Check current metrics in window for spikes
      const currentValues = currentMetrics
        .filter((m) => m.metricName === name)
        .map((m) => Number(m.metricValue || 0));

      const maxCurrent = Math.max(...currentValues);

      if (maxCurrent > mean + 3 * stdDev && Math.abs(maxCurrent - mean) > 1.0) {
        spikes.push({
          name,
          baseline: Number(mean.toFixed(2)),
          current: Number(maxCurrent.toFixed(2)),
        });
      }
    }

    return spikes;
  }
}
