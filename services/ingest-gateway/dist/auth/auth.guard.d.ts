import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { RedisService } from '../redis/redis.service';
export declare class AuthGuard implements CanActivate {
    private readonly apiKeyRepository;
    private readonly redisService;
    constructor(apiKeyRepository: Repository<ApiKey>, redisService: RedisService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
