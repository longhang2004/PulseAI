import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kafka, Consumer } from 'kafkajs';
import { Incident } from '../entities/incident.entity';
import { IncidentsGateway } from '../websockets/incidents.gateway';

@Injectable()
export class ApiConsumer implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    private readonly incidentsGateway: IncidentsGateway,
  ) {}

  async onModuleInit() {
    const brokers = process.env.KAFKA_BROKERS || 'localhost:9092';
    
    this.kafka = new Kafka({
      clientId: 'api-service-consumer',
      brokers: brokers.split(','),
    });

    this.consumer = this.kafka.consumer({ groupId: 'api-service-group' });

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: 'pulseai.incidents.created', fromBeginning: true });
      await this.consumer.subscribe({ topic: 'pulseai.incidents.updated', fromBeginning: true });
      await this.consumer.subscribe({ topic: 'pulseai.incidents.resolved', fromBeginning: true });

      await this.consumer.run({
        eachMessage: async ({ topic, message }) => {
          try {
            const rawValue = message.value?.toString();
            if (!rawValue) return;

            const payload = JSON.parse(rawValue);
            const incidentId = payload.incidentId;
            
            if (incidentId) {
              await this.handleIncidentEvent(topic, incidentId, payload);
            }
          } catch (err: any) {
            console.error(`[API Kafka] Error processing message on topic ${topic}:`, err.message);
          }
        },
      });
      console.log('API Kafka Consumer listening to incident topics');
    } catch (err) {
      console.error('Failed to boot API Kafka Consumer:', err);
    }
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }

  private async handleIncidentEvent(topic: string, incidentId: string, eventPayload: any) {
    const incident = await this.incidentRepository.findOne({ where: { id: incidentId } });
    if (!incident) {
      console.warn(`[API Kafka] Incident ${incidentId} not found in DB, skipping socket broadcast`);
      return;
    }

    let socketEvent = 'incident_created';
    if (topic.endsWith('updated')) {
      socketEvent = 'incident_updated';
    } else if (topic.endsWith('resolved')) {
      socketEvent = 'incident_resolved';
    }

    this.incidentsGateway.broadcastIncidentEvent(
      incident.projectId,
      socketEvent,
      {
        incidentId,
        projectId: incident.projectId,
        event: socketEvent,
        data: {
          ...incident,
          ...eventPayload,
        },
      },
    );
  }
}
