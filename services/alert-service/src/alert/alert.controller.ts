import { Controller, Get, Post, Put, Delete, Param, Body, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRule } from '../entities/alert-rule.entity';

@Controller('alerts/rules')
export class AlertController {
  constructor(
    @InjectRepository(AlertRule)
    private readonly alertRuleRepository: Repository<AlertRule>,
  ) {}

  @Post()
  async createRule(@Body() body: Partial<AlertRule>) {
    const rule = this.alertRuleRepository.create(body);
    const saved = await this.alertRuleRepository.save(rule);
    return {
      success: true,
      data: saved,
      error: null,
      meta: {},
    };
  }

  @Get('project/:projectId')
  async getRulesByProject(@Param('projectId') projectId: string) {
    const rules = await this.alertRuleRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
    return {
      success: true,
      data: rules,
      error: null,
      meta: {},
    };
  }

  @Put(':id')
  async updateRule(@Param('id') id: string, @Body() body: Partial<AlertRule>) {
    const rule = await this.alertRuleRepository.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Alert rule ${id} not found`);
    }
    Object.assign(rule, body);
    const saved = await this.alertRuleRepository.save(rule);
    return {
      success: true,
      data: saved,
      error: null,
      meta: {},
    };
  }

  @Delete(':id')
  async deleteRule(@Param('id') id: string) {
    const rule = await this.alertRuleRepository.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Alert rule ${id} not found`);
    }
    await this.alertRuleRepository.remove(rule);
    return {
      success: true,
      data: { id },
      error: null,
      meta: {},
    };
  }
}
