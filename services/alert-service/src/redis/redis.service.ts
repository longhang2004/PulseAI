import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  onModuleInit() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    this.client = new Redis({
      host,
      port,
      maxRetriesPerRequest: null,
    });

    this.client.on('connect', () => {
      console.log('Successfully connected to Redis (Alert Service)');
    });

    this.client.on('error', (err) => {
      console.error('Redis connection error (Alert Service):', err);
    });
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  getClient(): Redis {
    return this.client;
  }
}
