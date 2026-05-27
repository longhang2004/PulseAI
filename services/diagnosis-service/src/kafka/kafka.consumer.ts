import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { DiagnosisService } from '../diagnosis/diagnosis.service';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(private readonly diagnosisService: DiagnosisService) {}

  async onModuleInit() {
    const brokers = process.env.KAFKA_BROKERS || 'localhost:9092';
    
    this.kafka = new Kafka({
      clientId: 'diagnosis-service-consumer',
      brokers: brokers.split(','),
    });

    this.consumer = this.kafka.consumer({ groupId: 'diagnosis-service-group' });

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: 'pulseai.incidents.created', fromBeginning: true });

      await this.consumer.run({
        eachMessage: async ({ message }) => {
          try {
            const rawValue = message.value?.toString();
            if (!rawValue) return;

            const payload = JSON.parse(rawValue);
            const incidentId = payload.incidentId;
            
            if (incidentId) {
              console.log(`[Kafka] Received new incident: ${incidentId}. Ingesting evidence & running diagnosis...`);
              await this.diagnosisService.generateDiagnosis(incidentId);
            }
          } catch (err) {
            console.error('[Kafka] Error in incident message processing:', err.message);
          }
        },
      });
      console.log('Diagnosis Kafka Consumer listening to pulseai.incidents.created');
    } catch (err) {
      console.error('Failed to boot Diagnosis Kafka Consumer:', err);
    }
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
