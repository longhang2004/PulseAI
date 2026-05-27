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
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const api_key_entity_1 = require("../entities/api-key.entity");
const redis_service_1 = require("../redis/redis.service");
let AuthGuard = class AuthGuard {
    constructor(apiKeyRepository, redisService) {
        this.apiKeyRepository = apiKeyRepository;
        this.redisService = redisService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-api-key'];
        if (!apiKey || typeof apiKey !== 'string') {
            throw new common_1.UnauthorizedException('API key is missing or invalid');
        }
        const redis = this.redisService.getClient();
        const cacheKey = `pulseai:apikey:${apiKey}`;
        const cachedProjectId = await redis.get(cacheKey);
        if (cachedProjectId) {
            if (cachedProjectId === 'INVALID') {
                throw new common_1.UnauthorizedException('Invalid API Key');
            }
            request.projectId = cachedProjectId;
            request.apiKey = apiKey;
            return true;
        }
        const keyRecord = await this.apiKeyRepository.findOne({
            where: { key: apiKey, isActive: true },
        });
        if (!keyRecord) {
            await redis.set(cacheKey, 'INVALID', 'EX', 60);
            throw new common_1.UnauthorizedException('Invalid API Key');
        }
        await redis.set(cacheKey, keyRecord.projectId, 'EX', 300);
        request.projectId = keyRecord.projectId;
        request.apiKey = apiKey;
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(api_key_entity_1.ApiKey)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        redis_service_1.RedisService])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map