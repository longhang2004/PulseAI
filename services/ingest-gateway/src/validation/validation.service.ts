import { Injectable } from '@nestjs/common';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

@Injectable()
export class ValidationService {
  private ajv: Ajv;
  private logValidator: ValidateFunction;
  private metricValidator: ValidateFunction;
  private traceValidator: ValidateFunction;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, useDefaults: true });
    addFormats(this.ajv);

    this.initSchemas();
  }

  private initSchemas() {
    const logSchema = {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'LOG' },
        streamId: { type: 'string', minLength: 1 },
        timestamp: { type: 'string', format: 'date-time' },
        level: { type: 'string', enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] },
        message: { type: 'string' },
        attributes: { type: 'object' },
        traceId: { type: 'string' },
      },
      required: ['type', 'streamId', 'timestamp', 'level', 'message', 'attributes'],
      additionalProperties: false,
    };

    const metricSchema = {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'METRIC' },
        streamId: { type: 'string', minLength: 1 },
        timestamp: { type: 'string', format: 'date-time' },
        name: { type: 'string', minLength: 1 },
        value: { type: 'number' },
        unit: { type: 'string' },
        tags: { type: 'object' },
      },
      required: ['type', 'streamId', 'timestamp', 'name', 'value', 'unit', 'tags'],
      additionalProperties: false,
    };

    const traceSchema = {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'TRACE' },
        streamId: { type: 'string', minLength: 1 },
        timestamp: { type: 'string', format: 'date-time' },
        traceId: { type: 'string', minLength: 1 },
        spanId: { type: 'string', minLength: 1 },
        parentSpanId: { type: 'string' },
        operationName: { type: 'string', minLength: 1 },
        durationMs: { type: 'number', minimum: 0 },
        status: { type: 'string', enum: ['OK', 'ERROR'] },
        attributes: { type: 'object' },
      },
      required: ['type', 'streamId', 'timestamp', 'traceId', 'spanId', 'operationName', 'durationMs', 'status', 'attributes'],
      additionalProperties: false,
    };

    this.logValidator = this.ajv.compile(logSchema);
    this.metricValidator = this.ajv.compile(metricSchema);
    this.traceValidator = this.ajv.compile(traceSchema);
  }

  validateSignal(signal: any): { valid: boolean; reason?: string } {
    if (!signal || typeof signal !== 'object') {
      return { valid: false, reason: 'Signal must be an object' };
    }

    // 1. Validate Base Type
    const type = signal.type;
    if (!type || typeof type !== 'string') {
      return { valid: false, reason: 'Signal type is missing or invalid' };
    }

    let validateFn: ValidateFunction;
    if (type === 'LOG') {
      validateFn = this.logValidator;
    } else if (type === 'METRIC') {
      validateFn = this.metricValidator;
    } else if (type === 'TRACE') {
      validateFn = this.traceValidator;
    } else {
      return { valid: false, reason: `Unsupported signal type: ${type}` };
    }

    // 2. Run Ajv JSON Schema check
    const ajvValid = validateFn(signal);
    if (!ajvValid) {
      const errors = validateFn.errors?.map((err) => `${err.instancePath} ${err.message}`).join(', ');
      return { valid: false, reason: errors || 'Schema validation failed' };
    }

    // 3. Custom Date Range Checks (Constraint: reject if > 7 days old or > 60s in future)
    const timestampMs = Date.parse((signal as any).timestamp);
    if (isNaN(timestampMs)) {
      return { valid: false, reason: 'Invalid ISO-8601 date format for timestamp' };
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const sixtySecsInFuture = now + 60 * 1000;

    if (timestampMs < sevenDaysAgo) {
      return { valid: false, reason: 'Timestamp is older than 7 days' };
    }
    if (timestampMs > sixtySecsInFuture) {
      return { valid: false, reason: 'Timestamp is more than 60 seconds in the future' };
    }

    return { valid: true };
  }
}
