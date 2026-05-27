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
exports.StreamTrackerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const stream_entity_1 = require("../entities/stream.entity");
const redis_service_1 = require("../redis/redis.service");
const schedule_1 = require("@nestjs/schedule");
let StreamTrackerService = class StreamTrackerService {
    constructor(streamRepository, redisService) {
        this.streamRepository = streamRepository;
        this.redisService = redisService;
    }
    async trackSignal(projectId, streamId, timestamp) {
        const redis = this.redisService.getClient();
        const knownStreamsKey = `pulseai:known-streams:${projectId}`;
        const isKnown = await redis.sismember(knownStreamsKey, streamId);
        if (!isKnown) {
            let stream = await this.streamRepository.findOne({
                where: { projectId, name: streamId },
            });
            if (!stream) {
                try {
                    stream = this.streamRepository.create({
                        projectId,
                        name: streamId,
                        signalCount: 0,
                        firstSeenAt: new Date(timestamp),
                        lastSignalAt: new Date(timestamp),
                    });
                    await this.streamRepository.save(stream);
                }
                catch (err) {
                    stream = await this.streamRepository.findOne({
                        where: { projectId, name: streamId },
                    });
                }
            }
            await redis.sadd(knownStreamsKey, streamId);
        }
        const countKey = `pulseai:stream-count:${projectId}`;
        const lastKey = `pulseai:stream-last:${projectId}`;
        await redis.hincrby(countKey, streamId, 1);
        await redis.hset(lastKey, streamId, timestamp);
    }
    async recordHeartbeat(projectId, streamId, sdkVersion, language) {
        const redis = this.redisService.getClient();
        const heartbeatKey = `pulseai:heartbeat:${streamId}`;
        const data = JSON.stringify({
            projectId,
            sdkVersion,
            language,
            timestamp: new Date().toISOString(),
        });
        await redis.set(heartbeatKey, data, 'EX', 300);
    }
    async flushCountersToDb() {
        const redis = this.redisService.getClient();
        const keys = await redis.keys('pulseai:stream-count:*');
        if (keys.length === 0)
            return;
        console.log(`[Cron] Flushing counters to DB for ${keys.length} projects...`);
        for (const key of keys) {
            const projectId = key.split(':').pop();
            const lastKey = `pulseai:stream-last:${projectId}`;
            const flushCountKey = `${key}:flush`;
            const flushLastKey = `${lastKey}:flush`;
            try {
                const countRenamed = await redis.rename(key, flushCountKey).catch(() => null);
                const lastRenamed = await redis.rename(lastKey, flushLastKey).catch(() => null);
                if (!countRenamed)
                    continue;
                const counts = await redis.hgetall(flushCountKey);
                const timestamps = lastRenamed ? await redis.hgetall(flushLastKey) : {};
                for (const [streamId, countStr] of Object.entries(counts)) {
                    const count = parseInt(countStr, 10);
                    const timestamp = timestamps[streamId];
                    if (isNaN(count))
                        continue;
                    const updateData = {
                        signalCount: () => `signal_count + ${count}`,
                    };
                    if (timestamp) {
                        updateData.lastSignalAt = new Date(timestamp);
                    }
                    await this.streamRepository.update({ projectId, name: streamId }, updateData);
                }
                await redis.del(flushCountKey);
                if (lastRenamed)
                    await redis.del(flushLastKey);
            }
            catch (err) {
                console.error(`[Cron] Error flushing counters for project ${projectId}:`, err);
            }
        }
    }
};
exports.StreamTrackerService = StreamTrackerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StreamTrackerService.prototype, "flushCountersToDb", null);
exports.StreamTrackerService = StreamTrackerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(stream_entity_1.Stream)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        redis_service_1.RedisService])
], StreamTrackerService);
//# sourceMappingURL=stream-tracker.service.js.map