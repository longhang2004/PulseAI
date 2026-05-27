import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('API key is missing or invalid');
    }

    const redis = this.redisService.getClient();
    const cacheKey = `pulseai:apikey:${apiKey}`;

    // 1. Check Redis Cache
    const cachedProjectId = await redis.get(cacheKey);
    if (cachedProjectId) {
      if (cachedProjectId === 'INVALID') {
        throw new UnauthorizedException('Invalid API Key');
      }
      request.projectId = cachedProjectId;
      request.apiKey = apiKey;
      return true;
    }

    // 2. Query TimescaleDB / Postgres
    const keyRecord = await this.apiKeyRepository.findOne({
      where: { key: apiKey, isActive: true },
    });

    if (!keyRecord) {
      // Cache negative lookup to prevent DB spam (TTL: 1 minute)
      await redis.set(cacheKey, 'INVALID', 'EX', 60);
      throw new UnauthorizedException('Invalid API Key');
    }

    // 3. Cache valid projectId in Redis (TTL: 5 minutes)
    await redis.set(cacheKey, keyRecord.projectId, 'EX', 300);

    request.projectId = keyRecord.projectId;
    request.apiKey = apiKey;
    return true;
  }
}
