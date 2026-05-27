"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationService = void 0;
const common_1 = require("@nestjs/common");
const ajv_1 = require("ajv");
const ajv_formats_1 = require("ajv-formats");
let ValidationService = class ValidationService {
    constructor() {
        this.ajv = new ajv_1.default({ allErrors: true, useDefaults: true });
        (0, ajv_formats_1.default)(this.ajv);
        this.initSchemas();
    }
    initSchemas() {
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
    validateSignal(signal) {
        if (!signal || typeof signal !== 'object') {
            return { valid: false, reason: 'Signal must be an object' };
        }
        const type = signal.type;
        if (!type || typeof type !== 'string') {
            return { valid: false, reason: 'Signal type is missing or invalid' };
        }
        let validateFn;
        if (type === 'LOG') {
            validateFn = this.logValidator;
        }
        else if (type === 'METRIC') {
            validateFn = this.metricValidator;
        }
        else if (type === 'TRACE') {
            validateFn = this.traceValidator;
        }
        else {
            return { valid: false, reason: `Unsupported signal type: ${type}` };
        }
        const ajvValid = validateFn(signal);
        if (!ajvValid) {
            const errors = validateFn.errors?.map((err) => `${err.instancePath} ${err.message}`).join(', ');
            return { valid: false, reason: errors || 'Schema validation failed' };
        }
        const timestampMs = Date.parse(signal.timestamp);
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
};
exports.ValidationService = ValidationService;
exports.ValidationService = ValidationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ValidationService);
//# sourceMappingURL=validation.service.js.map