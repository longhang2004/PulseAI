"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaService = void 0;
const common_1 = require("@nestjs/common");
const kafkajs_1 = require("kafkajs");
let KafkaService = class KafkaService {
    async onModuleInit() {
        const brokers = process.env.KAFKA_BROKERS || 'localhost:9092';
        this.kafka = new kafkajs_1.Kafka({
            clientId: 'ingest-gateway',
            brokers: brokers.split(','),
        });
        this.producer = this.kafka.producer();
        try {
            await this.producer.connect();
            console.log('Successfully connected to Kafka Broker');
        }
        catch (err) {
            console.error('Failed to connect to Kafka Broker:', err);
        }
    }
    async onModuleDestroy() {
        await this.producer?.disconnect();
    }
    publish(topic, messagePayloads) {
        if (!this.producer) {
            console.error('Kafka producer is not initialized');
            return;
        }
        const messages = messagePayloads.map((payload) => ({
            value: JSON.stringify(payload),
        }));
        this.producer
            .send({
            topic,
            messages,
            acks: 0,
        })
            .catch((err) => {
            console.error(`Error sending messages to Kafka topic ${topic}:`, err);
        });
    }
    publishBatch(batches) {
        if (!this.producer) {
            console.error('Kafka producer is not initialized');
            return;
        }
        for (const batch of batches) {
            this.publish(batch.topic, batch.messages);
        }
    }
};
exports.KafkaService = KafkaService;
exports.KafkaService = KafkaService = __decorate([
    (0, common_1.Injectable)()
], KafkaService);
//# sourceMappingURL=kafka.service.js.map