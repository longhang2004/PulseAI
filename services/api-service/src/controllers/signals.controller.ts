import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SignalsQueryService } from '../signals/signals-query.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('signals')
@UseGuards(JwtAuthGuard)
export class SignalsController {
  constructor(private readonly signalsQueryService: SignalsQueryService) {}

  @Get('project/:projectId')
  async getSignals(
    @Param('projectId') projectId: string,
    @Query() query: {
      limit?: string;
      cursor?: string;
      streamId?: string;
      type?: string;
      level?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    const result = await this.signalsQueryService.findSignals(projectId, {
      ...query,
      limit,
    });
    return {
      success: true,
      data: result.signals,
      error: null,
      meta: {
        nextCursor: result.nextCursor,
      },
    };
  }
}
