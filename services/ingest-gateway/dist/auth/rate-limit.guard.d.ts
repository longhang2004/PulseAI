import { CanActivate, ExecutionContext } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
export declare class RateLimitGuard implements CanActivate {
    private readonly redisService;
    constructor(redisService: RedisService);
    private readonly luaScript;
    canActivate(context: ExecutionContext): Promise<boolean>;
}
