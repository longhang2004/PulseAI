import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface PulseAISDKConfig {
  apiKey: string;
  streamId: string;
  ingestUrl?: string;
}

export class PulseAISDK {
  private apiKey: string;
  private streamId: string;
  private ingestUrl: string;

  constructor(config: PulseAISDKConfig) {
    this.apiKey = config.apiKey;
    this.streamId = config.streamId;
    this.ingestUrl = config.ingestUrl || 'http://localhost:3000/ingest';
  }

  /**
   * Directly transmit a structured signal to the PulseAI Gateway.
   */
  async sendSignal(payload: any): Promise<void> {
    try {
      await axios.post(this.ingestUrl, payload, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 2000,
      });
    } catch (err: any) {
      console.warn(`[PulseAI SDK] Telemetry dispatch failed: ${err.message}`);
    }
  }

  /**
   * Winston Transport Integration:
   * Returns a custom object matching the winston transport specification.
   */
  getWinstonTransport() {
    const self = this;
    // We import dynamically or mock winston-transport base to avoid hard peer dependency
    try {
      const Transport = require('winston-transport');
      
      class PulseAIWinstonTransport extends Transport {
        constructor(opts?: any) {
          super(opts);
        }

        log(info: any, callback: () => void) {
          setImmediate(() => {
            this.emit('logged', info);
          });

          const levelMap: Record<string, string> = {
            error: 'ERROR',
            warn: 'WARN',
            info: 'INFO',
            verbose: 'DEBUG',
            debug: 'DEBUG',
            silly: 'DEBUG',
          };

          const mappedLevel = levelMap[info.level] || 'INFO';
          const signal = {
            type: 'LOG',
            streamId: self.streamId,
            timestamp: new Date().toISOString(),
            level: mappedLevel,
            message: info.message || JSON.stringify(info),
            attributes: {
              ...(typeof info === 'object' ? info : {}),
            },
            traceId: info.traceId || undefined,
          };

          self.sendSignal(signal);
          callback();
        }
      }

      return new PulseAIWinstonTransport();
    } catch (e) {
      // Dependency-free custom transport fallback for manual loggers
      return {
        log: (info: any, callback: () => void) => {
          const signal = {
            type: 'LOG',
            streamId: self.streamId,
            timestamp: new Date().toISOString(),
            level: info.level?.toUpperCase() || 'INFO',
            message: info.message || JSON.stringify(info),
            attributes: info,
          };
          self.sendSignal(signal);
          if (callback) callback();
        }
      };
    }
  }

  /**
   * Express Middleware Integration:
   * Captures performance metrics and routes telemetry trace details to the gateway.
   */
  getExpressMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime();
      const traceId = (req.headers['x-trace-id'] as string) || uuidv4();
      const spanId = uuidv4();

      // Attach tracing metadata to response headers
      res.setHeader('x-trace-id', traceId);
      res.setHeader('x-span-id', spanId);

      // Track response termination to measure duration
      res.on('finish', () => {
        const diff = process.hrtime(startTime);
        const durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
        const status = res.statusCode >= 400 ? 'ERROR' : 'OK';

        // 1. Send Trace Signal
        this.sendSignal({
          type: 'TRACE',
          streamId: this.streamId,
          timestamp: new Date().toISOString(),
          traceId,
          spanId,
          operationName: `${req.method} ${req.route?.path || req.path}`,
          durationMs,
          status,
          attributes: {
            httpMethod: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });

        // 2. Send Metric Signal for latency tracking
        this.sendSignal({
          type: 'METRIC',
          streamId: this.streamId,
          timestamp: new Date().toISOString(),
          name: 'http_request_latency',
          value: durationMs,
          unit: 'ms',
          tags: {
            method: req.method,
            route: req.route?.path || req.path,
            status: String(res.statusCode),
          },
        });
      });

      next();
    };
  }
}
