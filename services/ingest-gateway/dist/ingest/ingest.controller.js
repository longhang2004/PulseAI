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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const rate_limit_guard_1 = require("../auth/rate-limit.guard");
const validation_service_1 = require("../validation/validation.service");
const kafka_service_1 = require("../kafka/kafka.service");
const stream_tracker_service_1 = require("./stream-tracker.service");
const uuid_1 = require("uuid");
let IngestController = class IngestController {
    constructor(validationService, kafkaService, streamTrackerService) {
        this.validationService = validationService;
        this.kafkaService = kafkaService;
        this.streamTrackerService = streamTrackerService;
    }
    async ingestBatch(body, req) {
        const projectId = req.projectId;
        if (!body || !body.signals || !Array.isArray(body.signals)) {
            return { accepted: 0, rejected: 1, errors: [{ index: 0, reason: 'Payload must contain a signals array' }] };
        }
        const signals = body.signals;
        if (signals.length > 1000) {
            return { accepted: 0, rejected: signals.length, errors: [{ index: -1, reason: 'Batch size exceeds limit of 1000 signals' }] };
        }
        const acceptedSignals = {
            LOG: [],
            METRIC: [],
            TRACE: [],
        };
        const errors = [];
        const nowStr = new Date().toISOString();
        for (let i = 0; i < signals.length; i++) {
            const signal = signals[i];
            const validation = this.validationService.validateSignal(signal);
            if (!validation.valid) {
                errors.push({ index: i, reason: validation.reason || 'Validation failed' });
                continue;
            }
            const enrichedSignal = {
                ...signal,
                signalId: (0, uuid_1.v4)(),
                projectId,
                receivedAt: nowStr,
            };
            await this.streamTrackerService.trackSignal(projectId, signal.streamId, signal.timestamp);
            acceptedSignals[signal.type].push(enrichedSignal);
        }
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
    async ingestSingleLog(logBody, req) {
        const signal = { ...logBody, type: 'LOG' };
        const batchResult = await this.ingestBatch({ signals: [signal] }, req);
        return batchResult;
    }
    async ingestSingleMetric(metricBody, req) {
        const signal = { ...metricBody, type: 'METRIC' };
        const batchResult = await this.ingestBatch({ signals: [signal] }, req);
        return batchResult;
    }
    async ingestSingleTrace(traceBody, req) {
        const signal = { ...traceBody, type: 'TRACE' };
        const batchResult = await this.ingestBatch({ signals: [signal] }, req);
        return batchResult;
    }
    async sdkHeartbeat(body, req) {
        const projectId = req.projectId;
        const { streamId, sdkVersion, language } = body;
        if (!streamId || !sdkVersion || !language) {
            return { success: false, error: 'Missing required heartbeat fields' };
        }
        await this.streamTrackerService.recordHeartbeat(projectId, streamId, sdkVersion, language);
        return { success: true };
    }
};
exports.IngestController = IngestController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IngestController.prototype, "ingestBatch", null);
__decorate([
    (0, common_1.Post)('log'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IngestController.prototype, "ingestSingleLog", null);
__decorate([
    (0, common_1.Post)('metric'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IngestController.prototype, "ingestSingleMetric", null);
__decorate([
    (0, common_1.Post)('trace'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IngestController.prototype, "ingestSingleTrace", null);
__decorate([
    (0, common_1.Post)('heartbeat'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IngestController.prototype, "sdkHeartbeat", null);
exports.IngestController = IngestController = __decorate([
    (0, common_1.Controller)('ingest'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rate_limit_guard_1.RateLimitGuard),
    __metadata("design:paramtypes", [validation_service_1.ValidationService,
        kafka_service_1.KafkaService,
        stream_tracker_service_1.StreamTrackerService])
], IngestController);
//# sourceMappingURL=ingest.controller.js.map