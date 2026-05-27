import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  private readonly luaScript = `
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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const apiKey = request.apiKey;

    if (!apiKey) {
      return true; // If no API key (e.g. public/JWT routes), skip this rate limiter
    }

    // Determine signal count cost of the request
    let cost = 1;
    if (request.body && Array.isArray(request.body.signals)) {
      cost = request.body.signals.length;
    }

    const redis = this.redisService.getClient();
    const redisKey = `pulseai:ratelimit:${apiKey}`;
    const now = Date.now();
    const hardLimit = 10000;
    const softLimit = 8000;

    // Execute atomic Lua script
    const result = await redis.eval(
      this.luaScript,
      1,
      redisKey,
      now.toString(),
      cost.toString(),
      hardLimit.toString()
    ) as [number, number, number];

    const [allowed, totalSignals, retryAfter] = result;

    if (allowed === 0) {
      response.header('Retry-After', retryAfter.toString());
      throw new HttpException(
        {
          success: false,
          error: 'Rate limit exceeded. Too many signals.',
          meta: { retryAfter },
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Add soft limit warning header
    if (totalSignals > softLimit) {
      response.header('X-RateLimit-Warning', 'true');
    }

    return true;
  }
}
