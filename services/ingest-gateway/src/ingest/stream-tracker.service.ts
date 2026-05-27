import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stream } from '../entities/stream.entity';
import { RedisService } from '../redis/redis.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class StreamTrackerService {
  constructor(
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    private readonly redisService: RedisService
  ) {}

  /**
   * Tracks signal arrival, auto-registers stream if new.
   */
  async trackSignal(projectId: string, streamId: string, timestamp: string): Promise<void> {
    const redis = this.redisService.getClient();
    const knownStreamsKey = `pulseai:known-streams:${projectId}`;

    // 1. Check if stream is known in Redis Set
    const isKnown = await redis.sismember(knownStreamsKey, streamId);

    if (!isKnown) {
      // Check database to see if it's there (cache miss on restart)
      let stream = await this.streamRepository.findOne({
        where: { projectId, name: streamId },
      });

      if (!stream) {
        // Create new stream entity
        try {
          stream = this.streamRepository.create({
            projectId,
            name: streamId,
            signalCount: 0,
            firstSeenAt: new Date(timestamp),
            lastSignalAt: new Date(timestamp),
          });
          await this.streamRepository.save(stream);
        } catch (err) {
          // Handle potential concurrency/unique constraint race condition
          stream = await this.streamRepository.findOne({
            where: { projectId, name: streamId },
          });
        }
      }

      // Add to Redis known streams set
      await redis.sadd(knownStreamsKey, streamId);
    }

    // 2. Increment signal count and update last signal time in Redis
    const countKey = `pulseai:stream-count:${projectId}`;
    const lastKey = `pulseai:stream-last:${projectId}`;

    await redis.hincrby(countKey, streamId, 1);
    await redis.hset(lastKey, streamId, timestamp);
  }

  /**
   * Records SDK heartbeat with a 5-minute TTL.
   */
  async recordHeartbeat(
    projectId: string,
    streamId: string,
    sdkVersion: string,
    language: string
  ): Promise<void> {
    const redis = this.redisService.getClient();
    const heartbeatKey = `pulseai:heartbeat:${streamId}`;

    const data = JSON.stringify({
      projectId,
      sdkVersion,
      language,
      timestamp: new Date().toISOString(),
    });

    await redis.set(heartbeatKey, data, 'EX', 300); // 5 min TTL
  }

  /**
   * Cron job that runs every 60 seconds to flush counts/timestamps to PostgreSQL.
   * Employs a safe RENAME strategy to prevent race conditions during flush.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async flushCountersToDb(): Promise<void> {
    const redis = this.redisService.getClient();
    
    // Find all count keys (pulseai:stream-count:<projectId>)
    const keys = await redis.keys('pulseai:stream-count:*');
    if (keys.length === 0) return;

    console.log(`[Cron] Flushing counters to DB for ${keys.length} projects...`);

    for (const key of keys) {
      const projectId = key.split(':').pop();
      const lastKey = `pulseai:stream-last:${projectId}`;

      const flushCountKey = `${key}:flush`;
      const flushLastKey = `${lastKey}:flush`;

      try {
        // Atomic renames to lock current counts
        const countRenamed = await redis.rename(key, flushCountKey).catch(() => null);
        const lastRenamed = await redis.rename(lastKey, flushLastKey).catch(() => null);

        if (!countRenamed) continue;

        // Fetch counts and timestamps
        const counts = await redis.hgetall(flushCountKey);
        const timestamps = lastRenamed ? await redis.hgetall(flushLastKey) : {};

        // Batch update streams in Postgres
        for (const [streamId, countStr] of Object.entries(counts)) {
          const count = parseInt(countStr, 10);
          const timestamp = timestamps[streamId];

          if (isNaN(count)) continue;

          // Increment count and update timestamp
          const updateData: any = {
            signalCount: () => `signal_count + ${count}`,
          };
          if (timestamp) {
            updateData.lastSignalAt = new Date(timestamp);
          }

          await this.streamRepository.update(
            { projectId, name: streamId },
            updateData
          );
        }

        // Clean up temporary flush keys
        await redis.del(flushCountKey);
        if (lastRenamed) await redis.del(flushLastKey);

      } catch (err) {
        console.error(`[Cron] Error flushing counters for project ${projectId}:`, err);
      }
    }
  }
}
