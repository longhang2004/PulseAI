import { Controller, Get, Post, Param, Query, UseGuards, NotFoundException, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from '../entities/incident.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KafkaProducerService } from '../kafka/kafka-producer.service';

@Controller('incidents')
@UseGuards(JwtAuthGuard)
export class IncidentsController {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepository: Repository<Diagnosis>,
    private readonly kafkaProducerService: KafkaProducerService,
  ) {}

  @Get('project/:projectId')
  async listIncidents(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    const where: any = { projectId };
    if (status) {
      where.status = status.toUpperCase();
    }
    if (severity) {
      where.severity = severity.toUpperCase();
    }

    const incidents = await this.incidentRepository.find({
      where,
      order: { detectedAt: 'DESC' },
    });

    return {
      success: true,
      data: incidents,
      error: null,
      meta: {},
    };
  }

  @Get(':id')
  async getIncident(@Param('id') id: string) {
    const incident = await this.incidentRepository.findOne({ where: { id } });
    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }
    return {
      success: true,
      data: incident,
      error: null,
      meta: {},
    };
  }

  @Get(':id/diagnosis')
  async getDiagnosis(@Param('id') incidentId: string) {
    const diagnosis = await this.diagnosisRepository.findOne({ where: { incidentId } });
    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis for incident ${incidentId} not found`);
    }
    return {
      success: true,
      data: diagnosis,
      error: null,
      meta: {},
    };
  }

  @Post(':id/resolve')
  async resolveIncident(@Param('id') id: string) {
    const incident = await this.incidentRepository.findOne({ where: { id } });
    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    incident.status = 'RESOLVED';
    incident.resolvedAt = new Date();
    const saved = await this.incidentRepository.save(incident);

    // Publish to Kafka: pulseai.incidents.updated and/or pulseai.incidents.resolved
    await this.kafkaProducerService.publish('pulseai.incidents.resolved', incident.id, {
      incidentId: incident.id,
      resolvedAt: incident.resolvedAt,
    });

    await this.kafkaProducerService.publish('pulseai.incidents.updated', incident.id, {
      incidentId: incident.id,
      status: 'RESOLVED',
      resolvedAt: incident.resolvedAt,
    });

    return {
      success: true,
      data: saved,
      error: null,
      meta: {},
    };
  }
}
