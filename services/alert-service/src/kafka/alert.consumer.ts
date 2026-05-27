import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kafka, Consumer } from 'kafkajs';
import { AlertRule } from '../entities/alert-rule.entity';
import { Incident } from '../entities/incident.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { ConditionEvaluator } from '../alert/condition-evaluator';
import { NotifierService } from '../alert/notifier.service';

@Injectable()
export class AlertConsumer implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(
    @InjectRepository(AlertRule)
    private readonly alertRuleRepository: Repository<AlertRule>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepository: Repository<Diagnosis>,
    private readonly conditionEvaluator: ConditionEvaluator,
    private readonly notifierService: NotifierService,
  ) {}

  async onModuleInit() {
    const brokers = process.env.KAFKA_BROKERS || 'localhost:9092';
    
    this.kafka = new Kafka({
      clientId: 'alert-service-consumer',
      brokers: brokers.split(','),
    });

    this.consumer = this.kafka.consumer({ groupId: 'alert-service-group' });

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
              console.log(`[Alert Kafka] Received new incident: ${incidentId}. Evaluating alert rules...`);
              await this.processIncident(incidentId);
            }
          } catch (err: any) {
            console.error('[Alert Kafka] Error processing incident message:', err.message);
          }
        },
      });
      console.log('Alert Kafka Consumer listening to pulseai.incidents.created');
    } catch (err) {
      console.error('Failed to boot Alert Kafka Consumer:', err);
    }
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }

  private async processIncident(incidentId: string) {
    const incident = await this.incidentRepository.findOne({ where: { id: incidentId } });
    if (!incident) {
      console.warn(`[Alert] Incident ${incidentId} not found in DB`);
      return;
    }

    // Find enabled rules for this project
    const rules = await this.alertRuleRepository.find({
      where: { projectId: incident.projectId, enabled: true },
    });

    if (rules.length === 0) {
      console.log(`[Alert] No enabled alert rules found for project ${incident.projectId}`);
      return;
    }

    // Filter matching rules
    const matchingRules = rules.filter((rule) =>
      this.conditionEvaluator.evaluate(incident, rule.condition),
    );

    if (matchingRules.length === 0) {
      console.log(`[Alert] Incident ${incidentId} did not match any alert rules`);
      return;
    }

    console.log(
      `[Alert] Incident ${incidentId} matches ${matchingRules.length} rules. Dispatching alerts...`,
    );

    // Retrieve diagnosis (wait up to 5 times for 2 seconds each to allow LLM diagnosis to populate)
    let diagnosis: Diagnosis | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      diagnosis = await this.diagnosisRepository.findOne({ where: { incidentId } });
      if (diagnosis) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (diagnosis) {
      console.log(`[Alert] Found AI diagnosis for incident ${incidentId} (attempt: ${diagnosis.modelUsed})`);
    } else {
      console.warn(`[Alert] AI diagnosis not found for incident ${incidentId} after waiting. Continuing with partial payload.`);
    }

    // Dispatch alerts
    for (const rule of matchingRules) {
      try {
        await this.notifierService.dispatch(rule, incident, diagnosis);
      } catch (err: any) {
        console.error(
          `[Alert] Failed to dispatch alert for rule ${rule.id}:`,
          err.message,
        );
      }
    }
  }
}
