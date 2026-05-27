import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SignalsQueryService } from '../signals/signals-query.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly signalsQueryService: SignalsQueryService) {}

  @Get('project/:projectId/latency')
  async getLatency(
    @Param('projectId') projectId: string,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = startDateStr ? new Date(startDateStr) : new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // default 24h ago

    const data = await this.signalsQueryService.getLatencyAnalytics(projectId, startDate, endDate);
    return {
      success: true,
      data,
      error: null,
      meta: {
        startDate,
        endDate,
      },
    };
  }

  @Get('project/:projectId/errors')
  async getErrors(
    @Param('projectId') projectId: string,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = startDateStr ? new Date(startDateStr) : new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // default 24h ago

    const data = await this.signalsQueryService.getErrorAnalytics(projectId, startDate, endDate);
    return {
      success: true,
      data,
      error: null,
      meta: {
        startDate,
        endDate,
      },
    };
  }
}
