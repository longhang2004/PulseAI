import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { ApiKey } from '../entities/api-key.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { randomBytes } from 'crypto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  @Post()
  async createProject(@Body('name') name: string) {
    const project = this.projectRepository.create({ name });
    const saved = await this.projectRepository.save(project);
    return {
      success: true,
      data: saved,
      error: null,
      meta: {},
    };
  }

  @Get()
  async listProjects() {
    const projects = await this.projectRepository.find({ order: { createdAt: 'DESC' } });
    return {
      success: true,
      data: projects,
      error: null,
      meta: {},
    };
  }

  @Post(':id/keys')
  async generateKey(@Param('id') projectId: string) {
    const rawKey = `pa_${randomBytes(24).toString('hex')}`;
    const apiKey = this.apiKeyRepository.create({
      projectId,
      key: rawKey,
      isActive: true,
    });
    const saved = await this.apiKeyRepository.save(apiKey);
    return {
      success: true,
      data: saved,
      error: null,
      meta: {},
    };
  }

  @Get(':id/keys')
  async listKeys(@Param('id') projectId: string) {
    const keys = await this.apiKeyRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
    return {
      success: true,
      data: keys,
      error: null,
      meta: {},
    };
  }
}
