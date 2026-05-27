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
exports.RateLimitGuard = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../redis/redis.service");
let RateLimitGuard = class RateLimitGuard {
    constructor(redisService) {
        this.redisService = redisService;
        this.luaScript = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local cost = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local window = 60000 -- 60 seconds

    local currentBucket = tostring(math.floor(now / 10000) * 10000)

    local buckets = redis.call('HGETALL', key)
    local total = 0
    local oldestBucketTime = nil

    for i = 1, #buckets, 2 do
      local bTime = tonumber(buckets[i])
      local bCount = tonumber(buckets[i+1])
      
      if bTime < now - window then
        redis.call('HDEL', key, buckets[i])
      else
        total = total + bCount
        if oldestBucketTime == nil or bTime < oldestBucketTime then
          oldestBucketTime = bTime
        end
      end
    end

    if total + cost > limit then
      local retryAfter = 1
      if oldestBucketTime then
        local oldestAge = now - oldestBucketTime
        retryAfter = math.ceil((window - oldestAge) / 1000)
      end
      if retryAfter <= 0 then retryAfter = 1 end
      return {0, total, retryAfter}
    else
      redis.call('HINCRBY', key, currentBucket, cost)
      redis.call('EXPIRE', key, 120)
      return {1, total + cost, 0}
    end
  `;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const apiKey = request.apiKey;
        if (!apiKey) {
            return true;
        }
        let cost = 1;
        if (request.body && Array.isArray(request.body.signals)) {
            cost = request.body.signals.length;
        }
        const redis = this.redisService.getClient();
        const redisKey = `pulseai:ratelimit:${apiKey}`;
        const now = Date.now();
        const hardLimit = 10000;
        const softLimit = 8000;
        const result = await redis.eval(this.luaScript, 1, redisKey, now.toString(), cost.toString(), hardLimit.toString());
        const [allowed, totalSignals, retryAfter] = result;
        if (allowed === 0) {
            response.header('Retry-After', retryAfter.toString());
            throw new common_1.HttpException({
                success: false,
                error: 'Rate limit exceeded. Too many signals.',
                meta: { retryAfter },
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        if (totalSignals > softLimit) {
            response.header('X-RateLimit-Warning', 'true');
        }
        return true;
    }
};
exports.RateLimitGuard = RateLimitGuard;
exports.RateLimitGuard = RateLimitGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], RateLimitGuard);
//# sourceMappingURL=rate-limit.guard.js.map