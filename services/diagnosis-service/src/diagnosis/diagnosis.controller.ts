import { Controller, Post, Body, Param, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiagnosisFeedback } from '../entities/feedback.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { DiagnosisService } from './diagnosis.service';

@Controller('diagnosis')
export class DiagnosisController {
  constructor(
    private readonly diagnosisService: DiagnosisService,
    @InjectRepository(DiagnosisFeedback)
    private readonly feedbackRepository: Repository<DiagnosisFeedback>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepository: Repository<Diagnosis>
  ) {}

  @Post(':incidentId/regenerate')
  @HttpCode(HttpStatus.OK)
  async regenerate(@Param('incidentId') incidentId: string) {
    const diagnosis = await this.diagnosisService.regenerateDiagnosis(incidentId);
    return {
      success: true,
      data: diagnosis,
    };
  }

  @Post(':id/feedback')
  @HttpCode(HttpStatus.OK)
  async submitFeedback(
    @Param('id') diagnosisId: string,
    @Body() body: { helpful: boolean; notes?: string }
  ) {
    // Check if diagnosis exists
    const diagnosis = await this.diagnosisRepository.findOne({ where: { id: diagnosisId } });
    if (!diagnosis) {
      throw new NotFoundException('Diagnosis not found');
    }

    const feedback = this.feedbackRepository.create({
      diagnosisId,
      helpful: body.helpful,
      notes: body.notes || '',
    });

    await this.feedbackRepository.save(feedback);

    return {
      success: true,
      data: {
        feedbackId: feedback.id,
      },
    };
  }
}
