import { Repository } from 'typeorm';
import { Stream } from '../entities/stream.entity';
import { RedisService } from '../redis/redis.service';
export declare class StreamTrackerService {
    private readonly streamRepository;
    private readonly redisService;
    constructor(streamRepository: Repository<Stream>, redisService: RedisService);
    trackSignal(projectId: string, streamId: string, timestamp: string): Promise<void>;
    recordHeartbeat(projectId: string, streamId: string, sdkVersion: string, language: string): Promise<void>;
    flushCountersToDb(): Promise<void>;
}
