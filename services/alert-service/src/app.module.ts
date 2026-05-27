import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertRule } from './entities/alert-rule.entity';
import { AlertHistory } from './entities/alert-history.entity';
import { Incident } from './entities/incident.entity';
import { Diagnosis } from './entities/diagnosis.entity';
import { RedisModule } from './redis/redis.module';
import { ConditionEvaluator } from './alert/condition-evaluator';
import { NotifierService } from './alert/notifier.service';
import { AlertConsumer } from './kafka/alert.consumer';
import { AlertController } from './alert/alert.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.TIMESCALEDB_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALEDB_PORT || '5432', 10),
      username: process.env.TIMESCALEDB_USER || 'postgres',
      password: process.env.TIMESCALEDB_PASSWORD || 'pulseai_secure_pass_2026',
      database: process.env.TIMESCALEDB_DB || 'pulseai',
      entities: [AlertRule, AlertHistory, Incident, Diagnosis],
      synchronize: true, // Auto-migrates schema in development
    }),
    TypeOrmModule.forFeature([AlertRule, AlertHistory, Incident, Diagnosis]),
    RedisModule,
  ],
  controllers: [AlertController],
  providers: [ConditionEvaluator, NotifierService, AlertConsumer],
})
export class AppModule {}
