import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stream } from '../entities/stream.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('streams')
@UseGuards(JwtAuthGuard)
export class StreamsController {
  constructor(
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
  ) {}

  @Get('project/:projectId')
  async listStreams(@Param('projectId') projectId: string) {
    const streams = await this.streamRepository.find({
      where: { projectId },
      order: { lastSignalAt: 'DESC' },
    });
    return {
      success: true,
      data: streams,
      error: null,
      meta: {},
    };
  }
}
