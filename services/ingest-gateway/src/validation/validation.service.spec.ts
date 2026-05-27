import { ValidationService } from './validation.service';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    service = new ValidationService();
  });

  it('should accept a valid LOG signal', () => {
    const signal = {
      type: 'LOG',
      streamId: 'api-service',
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'User login successful',
      attributes: { userId: '123' },
    };

    const result = service.validateSignal(signal);
    expect(result.valid).toBe(true);
  });

  it('should accept a valid METRIC signal', () => {
    const signal = {
      type: 'METRIC',
      streamId: 'api-service',
      timestamp: new Date().toISOString(),
      name: 'http.response.time',
      value: 124.5,
      unit: 'ms',
      tags: { path: '/login' },
    };

    const result = service.validateSignal(signal);
    expect(result.valid).toBe(true);
  });

  it('should accept a valid TRACE signal', () => {
    const signal = {
      type: 'TRACE',
      streamId: 'api-service',
      timestamp: new Date().toISOString(),
      traceId: 'trace-123456',
      spanId: 'span-987654',
      operationName: 'GET /login',
      durationMs: 15,
      status: 'OK',
      attributes: { ip: '127.0.0.1' },
    };

    const result = service.validateSignal(signal);
    expect(result.valid).toBe(true);
  });

  it('should reject a signal with invalid type', () => {
    const signal = {
      type: 'INVALID_TYPE',
      streamId: 'api-service',
      timestamp: new Date().toISOString(),
    };

    const result = service.validateSignal(signal);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unsupported signal type');
  });

  it('should reject a LOG signal missing required fields', () => {
    const signal = {
      type: 'LOG',
      streamId: 'api-service',
      timestamp: new Date().toISOString(),
      // missing level, message, attributes
    };

    const result = service.validateSignal(signal);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('must have required property');
  });

  it('should reject a signal with timestamp older than 7 days', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 8); // 8 days ago

    const signal = {
      type: 'LOG',
      streamId: 'api-service',
      timestamp: oldDate.toISOString(),
      level: 'INFO',
      message: 'Old log',
      attributes: {},
    };

    const result = service.validateSignal(signal);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('older than 7 days');
  });

  it('should reject a signal with timestamp in the future by more than 60s', () => {
    const futureDate = new Date(Date.now() + 120 * 1000); // 2 minutes in future

    const signal = {
      type: 'LOG',
      streamId: 'api-service',
      timestamp: futureDate.toISOString(),
      level: 'INFO',
      message: 'Future log',
      attributes: {},
    };

    const result = service.validateSignal(signal);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('more than 60 seconds in the future');
  });
});
