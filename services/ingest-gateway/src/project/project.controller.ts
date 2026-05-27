import { Controller, Post, Body, Param, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { ApiKey } from '../entities/api-key.entity';
import * as crypto from 'crypto';

@Controller('projects')
export class ProjectController {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>
  ) {}

  @Post()
  async createProject(@Body('name') name: string) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Project name is required' };
    }

    const project = this.projectRepository.create({ name });
    const savedProject = await this.projectRepository.save(project);

    return {
      success: true,
      data: savedProject,
    };
  }

  @Post(':id/keys')
  async generateKey(@Param('id') projectId: string) {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Generate a secure API Key prefixing with 'pa_' for identification
    const randomBytes = crypto.randomBytes(24).toString('hex');
    const apiKeyString = `pa_${randomBytes}`;

    const apiKey = this.apiKeyRepository.create({
      key: apiKeyString,
      projectId: project.id,
      isActive: true,
    });
    const savedKey = await this.apiKeyRepository.save(apiKey);

    return {
      success: true,
      data: {
        id: savedKey.id,
        key: savedKey.key, // Exposed once upon generation
        projectId: savedKey.projectId,
        isActive: savedKey.isActive,
        createdAt: savedKey.createdAt,
      },
    };
  }

  // Helper route to get project details in development
  @Get(':id')
  async getProject(@Param('id') id: string) {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return { success: true, data: project };
  }
}
