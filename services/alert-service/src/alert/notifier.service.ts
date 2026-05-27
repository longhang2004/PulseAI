import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { AlertRule } from '../entities/alert-rule.entity';
import { AlertHistory } from '../entities/alert-history.entity';
import { RedisService } from '../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotifierService {
  constructor(
    @InjectRepository(AlertHistory)
    private readonly alertHistoryRepository: Repository<AlertHistory>,
    private readonly redisService: RedisService,
  ) {}

  async dispatch(rule: AlertRule, incident: any, diagnosis: any): Promise<void> {
    const redis = this.redisService.getClient();
    const idempotencyKey = `pulseai:alert-sent:${rule.id}:${incident.id}`;

    // 10-minute idempotency lock (600 seconds)
    const lock = await redis.set(idempotencyKey, '1', 'EX', 600, 'NX');
    if (!lock) {
      console.log(`[Notifier] Duplicate alert suppressed. Rule: ${rule.id}, Incident: ${incident.id}`);
      return;
    }

    const channels = rule.channels;

    if (channels.slack?.webhookUrl) {
      await this.sendSlack(rule, incident, diagnosis);
    }

    if (channels.email?.to && channels.email.to.length > 0) {
      await this.sendEmail(rule, incident, diagnosis);
    }

    if (channels.webhook?.url) {
      await this.sendWebhook(rule, incident, diagnosis);
    }
  }

  private async sendSlack(rule: AlertRule, incident: any, diagnosis: any): Promise<void> {
    const webhookUrl = rule.channels.slack?.webhookUrl;
    if (!webhookUrl || webhookUrl === 'placeholder') {
      await this.logHistory(rule, incident.id, 'slack', 'failed', 'Missing or placeholder Slack webhook URL');
      return;
    }

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨 PulseAI Alert: ${incident.title || 'Incident Detected'}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Type:*\n${incident.type}` },
          { type: 'mrkdwn', text: `*Severity:*\n${incident.severity}` },
          { type: 'mrkdwn', text: `*Stream:*\n${incident.streamId}` },
          { type: 'mrkdwn', text: `*Detected At:*\n${new Date(incident.detectedAt).toISOString()}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Trigger Value:* \`${incident.triggerValue}\` (Threshold: \`${incident.triggerThreshold}\`)`,
        },
      },
    ];

    if (diagnosis && diagnosis.llmResponse) {
      const resp = diagnosis.llmResponse;
      const actions = Array.isArray(resp.immediateActions)
        ? resp.immediateActions.map((a: string) => `• ${a}`).join('\n')
        : 'N/A';
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*AI Diagnosis (Confidence: ${diagnosis.confidence || 'MEDIUM'} via ${diagnosis.modelUsed || 'LLM'}):*\n*Root Cause Summary:* ${resp.rootCauseSummary || 'N/A'}\n*Immediate Actions:*\n${actions}`,
        },
      });
    }

    try {
      await axios.post(webhookUrl, { blocks });
      await this.logHistory(rule, incident.id, 'slack', 'success');
      console.log(`[Notifier] Slack alert sent for incident ${incident.id}`);
    } catch (err: any) {
      const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      await this.logHistory(rule, incident.id, 'slack', 'failed', errorMsg);
      console.error(`[Notifier] Failed to send Slack alert:`, errorMsg);
    }
  }

  private async sendEmail(rule: AlertRule, incident: any, diagnosis: any): Promise<void> {
    const apiKey = process.env.SENDGRID_API_KEY;
    const toEmails = rule.channels.email?.to || [];

    if (!apiKey || apiKey === 'placeholder') {
      await this.logHistory(rule, incident.id, 'email', 'failed', 'Missing SendGrid API Key');
      return;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
        <h2 style="color: #d9534f; margin-top: 0;">🚨 PulseAI Observability Alert</h2>
        <p><strong>Incident Title:</strong> ${incident.title}</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Type</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${incident.type}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Severity</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><span style="background: #f0ad4e; padding: 2px 6px; color: #fff; border-radius: 3px;">${incident.severity}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Stream</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${incident.streamId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Trigger Value</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${incident.triggerValue} (Threshold: ${incident.triggerThreshold})</td>
          </tr>
        </table>
        ${
          diagnosis && diagnosis.llmResponse
            ? `
          <div style="background-color: #f7f9fa; padding: 15px; border-left: 4px solid #0275d8; border-radius: 3px; margin-top: 15px;">
            <h3 style="margin-top: 0; color: #0275d8;">🤖 AI Diagnosis (${diagnosis.confidence} Confidence)</h3>
            <p><strong>Root Cause Summary:</strong> ${diagnosis.llmResponse.rootCauseSummary}</p>
            <p><strong>Root Cause Detail:</strong> ${diagnosis.llmResponse.rootCauseDetail}</p>
            <p><strong>Immediate Actions:</strong></p>
            <ul>
              ${(diagnosis.llmResponse.immediateActions || []).map((a: string) => `<li>${a}</li>`).join('')}
            </ul>
          </div>
          `
            : ''
        }
        <p style="font-size: 12px; color: #777; margin-top: 25px; border-top: 1px solid #eee; padding-top: 10px;">
          This is an automated alert sent by PulseAI.
        </p>
      </div>
    `;

    try {
      await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [
            {
              to: toEmails.map((email) => ({ email })),
            },
          ],
          from: { email: 'alerts@pulseai.dev', name: 'PulseAI Alerts' },
          subject: `🚨 [PulseAI] ${incident.severity} Incident: ${incident.title}`,
          content: [
            {
              type: 'text/html',
              value: htmlContent,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      await this.logHistory(rule, incident.id, 'email', 'success');
      console.log(`[Notifier] Email alert sent for incident ${incident.id} to ${toEmails.join(', ')}`);
    } catch (err: any) {
      const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      await this.logHistory(rule, incident.id, 'email', 'failed', errorMsg);
      console.error(`[Notifier] Failed to send Email alert:`, errorMsg);
    }
  }

  private async sendWebhook(rule: AlertRule, incident: any, diagnosis: any): Promise<void> {
    const url = rule.channels.webhook?.url;
    if (!url) {
      await this.logHistory(rule, incident.id, 'webhook', 'failed', 'Missing webhook URL');
      return;
    }

    try {
      await axios.post(url, {
        incident,
        diagnosis: diagnosis || null,
      });
      await this.logHistory(rule, incident.id, 'webhook', 'success');
      console.log(`[Notifier] Webhook alert sent for incident ${incident.id}`);
    } catch (err: any) {
      const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      await this.logHistory(rule, incident.id, 'webhook', 'failed', errorMsg);
      console.error(`[Notifier] Failed to send Webhook alert:`, errorMsg);
    }
  }

  private async logHistory(
    rule: AlertRule,
    incidentId: string,
    channel: 'slack' | 'email' | 'webhook',
    status: 'success' | 'failed',
    error?: string,
  ): Promise<void> {
    try {
      const history = this.alertHistoryRepository.create({
        id: uuidv4(),
        projectId: rule.projectId,
        ruleId: rule.id,
        incidentId,
        channel,
        status,
        error: error || null,
      });
      await this.alertHistoryRepository.save(history);
    } catch (err: any) {
      console.error('[Notifier] Failed to save AlertHistory:', err.message);
    }
  }
}
