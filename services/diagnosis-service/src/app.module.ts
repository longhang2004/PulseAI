import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diagnosis } from './entities/diagnosis.entity';
import { DiagnosisFeedback } from './entities/feedback.entity';
import { Incident } from './entities/incident.entity';
import { Signal } from './entities/signal.entity';
import { RedisModule } from './redis/redis.module';
import { LlmModule } from './llm/llm.module';
import { EvidenceService } from './diagnosis/evidence.service';
import { DiagnosisService } from './diagnosis/diagnosis.service';
import { DiagnosisController } from './diagnosis/diagnosis.controller';
import { KafkaProducerService } from './kafka/kafka-producer.service';
import { KafkaConsumerService } from './kafka/kafka.consumer';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.TIMESCALEDB_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALEDB_PORT || '5432', 10),
      username: process.env.TIMESCALEDB_USER || 'postgres',
      password: process.env.TIMESCALEDB_PASSWORD || 'pulseai_secure_pass_2026',
      database: process.env.TIMESCALEDB_DB || 'pulseai',
      entities: [Diagnosis, DiagnosisFeedback, Incident, Signal],
      synchronize: true, // Automigrates schema in development
    }),
    TypeOrmModule.forFeature([Diagnosis, DiagnosisFeedback, Incident, Signal]),
    RedisModule,
    LlmModule,
  ],
  controllers: [DiagnosisController],
  providers: [EvidenceService, DiagnosisService, KafkaProducerService, KafkaConsumerService],
  exports: [TypeOrmModule],
})
export class AppModule {}
