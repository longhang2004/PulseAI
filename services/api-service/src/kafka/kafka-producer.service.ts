import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;

  async onModuleInit() {
    const brokers = process.env.KAFKA_BROKERS || 'localhost:9092';
    this.kafka = new Kafka({
      clientId: 'api-service-producer',
      brokers: brokers.split(','),
    });
    this.producer = this.kafka.producer();
    try {
      await this.producer.connect();
      console.log('API Gateway Kafka Producer connected successfully');
    } catch (err) {
      console.error('Failed to connect API Gateway Kafka Producer:', err);
    }
  }

  async onModuleDestroy() {
    await this.producer?.disconnect();
  }

  async publish(topic: string, key: string, payload: any): Promise<void> {
    if (!this.producer) {
      console.error('Producer not available');
      return;
    }
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(payload) }],
    }).catch(err => {
      console.error(`Failed to publish key ${key} to topic ${topic}:`, err);
    });
  }
}
