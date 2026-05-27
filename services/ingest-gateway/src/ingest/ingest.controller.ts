import { Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RateLimitGuard } from '../auth/rate-limit.guard';
import { ValidationService } from '../validation/validation.service';
import { KafkaService } from '../kafka/kafka.service';
import { StreamTrackerService } from './stream-tracker.service';
import { v4 as uuidv4 } from 'uuid';

@Controller('ingest')
@UseGuards(AuthGuard, RateLimitGuard)
export class IngestController {
  constructor(
    private readonly validationService: ValidationService,
    private readonly kafkaService: KafkaService,
    private readonly streamTrackerService: StreamTrackerService
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async ingestBatch(@Body() body: { signals?: any[] }, @Req() req: any) {
    const projectId = req.projectId;

    if (!body || !body.signals || !Array.isArray(body.signals)) {
      return { accepted: 0, rejected: 1, errors: [{ index: 0, reason: 'Payload must contain a signals array' }] };
    }

    const signals = body.signals;
    if (signals.length > 1000) {
      return { accepted: 0, rejected: signals.length, errors: [{ index: -1, reason: 'Batch size exceeds limit of 1000 signals' }] };
    }

    const acceptedSignals: { LOG: any[]; METRIC: any[]; TRACE: any[] } = {
      LOG: [],
      METRIC: [],
      TRACE: [],
    };
    const errors: { index: number; reason: string }[] = [];
    const nowStr = new Date().toISOString();

    // Validate and Enrich each signal
    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];
      const validation = this.validationService.validateSignal(signal);

      if (!validation.valid) {
        errors.push({ index: i, reason: validation.reason || 'Validation failed' });
        continue;
      }

      // Enrich signal metadata
      const enrichedSignal = {
        ...signal,
        signalId: uuidv4(),
        projectId,
        receivedAt: nowStr,
      };

      // Auto-register and track stream
      await this.streamTrackerService.trackSignal(projectId, signal.streamId, signal.timestamp);

      // Group by topic type
      acceptedSignals[signal.type as 'LOG' | 'METRIC' | 'TRACE'].push(enrichedSignal);
    }

    // Publish valid signals to Kafka (fire-and-forget, grouped by topic)
    if (acceptedSignals.LOG.length > 0) {
      this.kafkaService.publish('pulseai.signals.log', acceptedSignals.LOG);
    }
    if (acceptedSignals.METRIC.length > 0) {
      this.kafkaService.publish('pulseai.signals.metric', acceptedSignals.METRIC);
    }
    if (acceptedSignals.TRACE.length > 0) {
      this.kafkaService.publish('pulseai.signals.trace', acceptedSignals.TRACE);
    }

    return {
      accepted: signals.length - errors.length,
      rejected: errors.length,
      errors,
    };
  }

  @Post('log')
  @HttpCode(HttpStatus.OK)
  async ingestSingleLog(@Body() logBody: any, @Req() req: any) {
    const signal = { ...logBody, type: 'LOG' };
    const batchResult = await this.ingestBatch({ signals: [signal] }, req);
    return batchResult;
  }

  @Post('metric')
  @HttpCode(HttpStatus.OK)
  async ingestSingleMetric(@Body() metricBody: any, @Req() req: any) {
    const signal = { ...metricBody, type: 'METRIC' };
    const batchResult = await this.ingestBatch({ signals: [signal] }, req);
    return batchResult;
  }

  @Post('trace')
  @HttpCode(HttpStatus.OK)
  async ingestSingleTrace(@Body() traceBody: any, @Req() req: any) {
    const signal = { ...traceBody, type: 'TRACE' };
    const batchResult = await this.ingestBatch({ signals: [signal] }, req);
    return batchResult;
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  async sdkHeartbeat(
    @Body() body: { streamId: string; sdkVersion: string; language: string },
    @Req() req: any
  ) {
    const projectId = req.projectId;
    const { streamId, sdkVersion, language } = body;

    if (!streamId || !sdkVersion || !language) {
      return { success: false, error: 'Missing required heartbeat fields' };
    }

    await this.streamTrackerService.recordHeartbeat(projectId, streamId, sdkVersion, language);

    return { success: true };
  }
}
