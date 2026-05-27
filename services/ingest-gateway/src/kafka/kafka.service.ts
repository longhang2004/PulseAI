import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;

  async onModuleInit() {
    const brokers = process.env.KAFKA_BROKERS || 'localhost:9092';
    
    this.kafka = new Kafka({
      clientId: 'ingest-gateway',
      brokers: brokers.split(','),
    });

    this.producer = this.kafka.producer();
    
    try {
      await this.producer.connect();
      console.log('Successfully connected to Kafka Broker');
    } catch (err) {
      console.error('Failed to connect to Kafka Broker:', err);
    }
  }

  async onModuleDestroy() {
    await this.producer?.disconnect();
  }

  /**
   * Publishes messages to a Kafka topic in a fire-and-forget manner (acks: 0).
   * Does not block HTTP response.
   */
  publish(topic: string, messagePayloads: any[]): void {
    if (!this.producer) {
      console.error('Kafka producer is not initialized');
      return;
    }

    const messages = messagePayloads.map((payload) => ({
      value: JSON.stringify(payload),
    }));

    // Fire-and-forget send (acks: 0) without awaiting
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

  /**
   * Publishes messages grouped by topic to minimize Kafka roundtrips.
   */
  publishBatch(batches: { topic: string; messages: any[] }[]): void {
    if (!this.producer) {
      console.error('Kafka producer is not initialized');
      return;
    }

    for (const batch of batches) {
      this.publish(batch.topic, batch.messages);
    }
  }
}
