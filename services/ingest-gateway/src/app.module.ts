import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Project } from './entities/project.entity';
import { ApiKey } from './entities/api-key.entity';
import { Stream } from './entities/stream.entity';
import { RedisModule } from './redis/redis.module';
import { ValidationModule } from './validation/validation.module';
import { KafkaModule } from './kafka/kafka.module';
import { ProjectController } from './project/project.controller';
import { IngestController } from './ingest/ingest.controller';
import { StreamTrackerService } from './ingest/stream-tracker.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.TIMESCALEDB_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALEDB_PORT || '5432', 10),
      username: process.env.TIMESCALEDB_USER || 'postgres',
      password: process.env.TIMESCALEDB_PASSWORD || 'pulseai_secure_pass_2026',
      database: process.env.TIMESCALEDB_DB || 'pulseai',
      entities: [Project, ApiKey, Stream],
      synchronize: true, // Automigrates schema in development
    }),
    TypeOrmModule.forFeature([Project, ApiKey, Stream]),
    RedisModule,
    ValidationModule,
    KafkaModule,
  ],
  controllers: [ProjectController, IngestController],
  providers: [StreamTrackerService],
  exports: [TypeOrmModule],
})
export class AppModule {}
