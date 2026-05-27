import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Project } from './entities/project.entity';
import { ApiKey } from './entities/api-key.entity';
import { Stream } from './entities/stream.entity';
import { Signal } from './entities/signal.entity';
import { Incident } from './entities/incident.entity';
import { Diagnosis } from './entities/diagnosis.entity';
import { DiagnosisFeedback } from './entities/feedback.entity';
import { SignalsQueryService } from './signals/signals-query.service';
import { IncidentsGateway } from './websockets/incidents.gateway';
import { KafkaProducerService } from './kafka/kafka-producer.service';
import { ApiConsumer } from './kafka/api.consumer';
import { ProjectsController } from './controllers/projects.controller';
import { StreamsController } from './controllers/streams.controller';
import { SignalsController } from './controllers/signals.controller';
import { IncidentsController } from './controllers/incidents.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { AuthController } from './controllers/auth.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.TIMESCALEDB_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALEDB_PORT || '5432', 10),
      username: process.env.TIMESCALEDB_USER || 'postgres',
      password: process.env.TIMESCALEDB_PASSWORD || 'pulseai_secure_pass_2026',
      database: process.env.TIMESCALEDB_DB || 'pulseai',
      entities: [Project, ApiKey, Stream, Signal, Incident, Diagnosis, DiagnosisFeedback],
      synchronize: true, // Auto-migrates schema in development
    }),
    TypeOrmModule.forFeature([Project, ApiKey, Stream, Signal, Incident, Diagnosis, DiagnosisFeedback]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'pulseai_jwt_secret_key_2026',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [
    AuthController,
    ProjectsController,
    StreamsController,
    SignalsController,
    IncidentsController,
    AnalyticsController,
  ],
  providers: [
    SignalsQueryService,
    IncidentsGateway,
    KafkaProducerService,
    ApiConsumer,
  ],
  exports: [JwtModule],
})
export class AppModule {}
