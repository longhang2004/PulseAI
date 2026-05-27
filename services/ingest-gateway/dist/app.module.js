"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const schedule_1 = require("@nestjs/schedule");
const project_entity_1 = require("./entities/project.entity");
const api_key_entity_1 = require("./entities/api-key.entity");
const stream_entity_1 = require("./entities/stream.entity");
const redis_module_1 = require("./redis/redis.module");
const validation_module_1 = require("./validation/validation.module");
const kafka_module_1 = require("./kafka/kafka.module");
const project_controller_1 = require("./project/project.controller");
const ingest_controller_1 = require("./ingest/ingest.controller");
const stream_tracker_service_1 = require("./ingest/stream-tracker.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                host: process.env.TIMESCALEDB_HOST || 'localhost',
                port: parseInt(process.env.TIMESCALEDB_PORT || '5432', 10),
                username: process.env.TIMESCALEDB_USER || 'postgres',
                password: process.env.TIMESCALEDB_PASSWORD || 'pulseai_secure_pass_2026',
                database: process.env.TIMESCALEDB_DB || 'pulseai',
                entities: [project_entity_1.Project, api_key_entity_1.ApiKey, stream_entity_1.Stream],
                synchronize: true,
            }),
            typeorm_1.TypeOrmModule.forFeature([project_entity_1.Project, api_key_entity_1.ApiKey, stream_entity_1.Stream]),
            redis_module_1.RedisModule,
            validation_module_1.ValidationModule,
            kafka_module_1.KafkaModule,
        ],
        controllers: [project_controller_1.ProjectController, ingest_controller_1.IngestController],
        providers: [stream_tracker_service_1.StreamTrackerService],
        exports: [typeorm_1.TypeOrmModule],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map