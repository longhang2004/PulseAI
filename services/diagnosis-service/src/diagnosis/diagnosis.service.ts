import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Incident } from '../entities/incident.entity';
import { EvidenceService } from './evidence.service';
import { LlmService } from '../llm/llm.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { RedisService } from '../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DiagnosisService {
  constructor(
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepository: Repository<Diagnosis>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    private readonly evidenceService: EvidenceService,
    private readonly llmService: LlmService,
    private readonly kafkaProducerService: KafkaProducerService,
    private readonly redisService: RedisService
  ) {}

  async generateDiagnosis(incidentId: string): Promise<Diagnosis> {
    const incident = await this.incidentRepository.findOne({ where: { id: incidentId } });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    let evidence: any = null;
    try {
      // 1. Gather Evidence from TimescaleDB
      evidence = await this.evidenceService.collectEvidence(incident);

      // 2. Compile Prompt (trims logs to 200 chars and limits total prompt size to 3,000 tokens)
      const prompt = this.buildPrompt(incident, evidence);

      // 3. Request LLM Diagnosis
      const llmResult = await this.llmService.callLLM(prompt);
      
      // 4. Parse LLM JSON Response
      const jsonResponse = JSON.parse(llmResult.text);

      // 5. Persist to DB
      const diagnosis = this.diagnosisRepository.create({
        id: uuidv4(),
        incidentId: incident.id,
        evidence,
        llmResponse: jsonResponse,
        confidence: jsonResponse.confidence || 'MEDIUM',
        modelUsed: llmResult.model,
        inputTokens: llmResult.inputTokens || 0,
        outputTokens: llmResult.outputTokens || 0,
      });

      const savedDiagnosis = await this.diagnosisRepository.save(diagnosis);

      // 6. Publish update to Kafka
      await this.publishUpdate(incident.id, savedDiagnosis.id);

      return savedDiagnosis;

    } catch (err) {
      console.error(`[Diagnosis] LLM pipeline failed for incident ${incidentId}, generating fallback...`, err.message);
      
      // Fallback Diagnosis
      const fallbackResponse = this.generateFallbackResponse(incident.type);
      const diagnosis = this.diagnosisRepository.create({
        id: uuidv4(),
        incidentId: incident.id,
        evidence: evidence || {},
        llmResponse: fallbackResponse,
        confidence: 'LOW',
        modelUsed: 'FALLBACK_PLAYBOOK',
        inputTokens: 0,
        outputTokens: 0,
      });

      const savedDiagnosis = await this.diagnosisRepository.save(diagnosis);
      await this.publishUpdate(incident.id, savedDiagnosis.id);
      return savedDiagnosis;
    }
  }

  /**
   * Triggers re-diagnosis. Enforces a 5-minute Redis-backed cooldown per incident.
   */
  async regenerateDiagnosis(incidentId: string): Promise<Diagnosis> {
    const redis = this.redisService.getClient();
    const cooldownKey = `pulseai:diagnosis-cooldown:${incidentId}`;

    const active = await redis.get(cooldownKey);
    if (active) {
      throw new HttpException(
        { success: false, error: 'Re-diagnosis is rate-limited. Once per 5 minutes per incident.' },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Trigger regeneration
    const diagnosis = await this.generateDiagnosis(incidentId);

    // Set 5-minute cooldown (300 seconds)
    await redis.set(cooldownKey, 'active', 'EX', 300);

    return diagnosis;
  }

  private buildPrompt(incident: Incident, evidence: any): string {
    // Truncate logs and format evidence
    const cleanLogs = (evidence.errorLogs || [])
      .map((log: string) => log.length > 200 ? log.slice(0, 197) + '...' : log);

    const contextObject = {
      incident: {
        type: incident.type,
        severity: incident.severity,
        triggerValue: incident.triggerValue,
        triggerThreshold: incident.triggerThreshold,
        detectedAt: incident.detectedAt,
      },
      stream: {
        name: incident.streamId,
      },
      evidence: {
        errorLogs: cleanLogs,
        topPatterns: evidence.topPatterns,
        stackTraces: evidence.stackTraces,
        latencyBaseline: evidence.latencyBaseline,
        latencyCurrent: evidence.latencyCurrent,
        metricSpikes: evidence.metricSpikes,
      }
    };

    let promptStr = `You are an expert SRE analyzing a production incident.

Incident: ${contextObject.incident.type} on stream "${contextObject.stream.name}"
Severity: ${contextObject.incident.severity}
Detected at: ${contextObject.incident.detectedAt}

Evidence:
- Error rate / Trigger Value: ${contextObject.incident.triggerValue} (Threshold: ${contextObject.incident.triggerThreshold})
- Top error patterns:
${JSON.stringify(contextObject.evidence.topPatterns, null, 2)}
- Extracted stack traces:
${JSON.stringify(contextObject.evidence.stackTraces, null, 2)}
- Latency change: P50/P95/P99 baseline: ${JSON.stringify(contextObject.evidence.latencyBaseline)} -> current: ${JSON.stringify(contextObject.evidence.latencyCurrent)}
- Metric spikes:
${JSON.stringify(contextObject.evidence.metricSpikes, null, 2)}

Respond ONLY with valid JSON matching the following structure:
{
  "rootCauseSummary": "one sentence",
  "rootCauseDetail": "2-3 sentences with technical specifics",
  "confidence": "LOW|MEDIUM|HIGH",
  "contributingFactors": ["factor 1", "factor 2"],
  "immediateActions": ["action 1", "action 2"],
  "investigationSteps": ["step 1", "step 2"],
  "preventionRecommendations": ["rec 1", "rec 2"],
  "relatedSignals": ["mention any trace IDs or patterns worth investigating"]
}
`;

    // Prompt Size Constraint Check: cap at roughly 12,000 characters (3,000 tokens)
    if (promptStr.length > 12000) {
      // Trim error logs to reduce size
      contextObject.evidence.errorLogs = contextObject.evidence.errorLogs.slice(0, 5);
      contextObject.evidence.stackTraces = contextObject.evidence.stackTraces.slice(0, 1);
      
      // Recompile trimmed prompt
      promptStr = this.buildPrompt(incident, contextObject.evidence);
    }

    return promptStr;
  }

  private generateFallbackResponse(type: string): any {
    const defaultPlaybook: Record<string, any> = {
      ERROR_RATE_SPIKE: {
        rootCauseSummary: "High HTTP/Signal error rates detected on stream.",
        rootCauseDetail: "Automated analysis unavailable — manual investigation required. Error logs are spiking beyond the safe limit.",
        confidence: "LOW",
        contributingFactors: ["Upstream dependency latency", "Database connection exhaustion"],
        immediateActions: ["Verify service health dashboard.", "Review upstream server resource usage."],
        investigationSteps: ["Examine application server access logs.", "Trace database connection pools."],
        preventionRecommendations: ["Increase container replica limits.", "Implement connection pooling retries."],
        relatedSignals: []
      },
      ERROR_BURST: {
        rootCauseSummary: "Sudden burst of application error logs.",
        rootCauseDetail: "Automated analysis unavailable — manual investigation required. High frequency of error logs has triggered a threshold breach.",
        confidence: "LOW",
        contributingFactors: ["Uncaught exceptions in runtime", "Downstream service outage"],
        immediateActions: ["Inspect log tail for specific stack trace patterns.", "Verify cloud provider status page."],
        investigationSteps: ["Locate the exact stack trace in the error logs.", "Run diagnostic queries on timescaledb."],
        preventionRecommendations: ["Improve global exception handling.", "Add circuit breakers on external HTTP calls."],
        relatedSignals: []
      },
      LATENCY_DEGRADATION: {
        rootCauseSummary: "P95 latency has degraded by more than 200%.",
        rootCauseDetail: "Automated analysis unavailable — manual investigation required. Telemetry trace durations indicate extreme latency spikes.",
        confidence: "LOW",
        contributingFactors: ["Database query lock contention", "Memory leaks leading to excessive garbage collection"],
        immediateActions: ["Check database slow query logs.", "Review CPU and heap memory utilization."],
        investigationSteps: ["Run EXPLAIN ANALYZE on database queries.", "Check JVM GC pause intervals."],
        preventionRecommendations: ["Index columns utilized in slow queries.", "Scale up target node memory sizing."],
        relatedSignals: []
      },
      SILENCE: {
        rootCauseSummary: "Telemetry stream has gone silent.",
        rootCauseDetail: "Automated analysis unavailable — manual investigation required. Heartbeats have ceased for more than 5 minutes.",
        confidence: "LOW",
        contributingFactors: ["Service daemon crashed", "Network configuration changes blocked SDK packets"],
        immediateActions: ["Check target application container runtime status.", "Verify firewall rules for Port 3000 Ingestion."],
        investigationSteps: ["SSH into the host instance to inspect syslog.", "Run connection check to ingest gateway."],
        preventionRecommendations: ["Set up systemd auto-restart policies.", "Add redundant network routing paths."],
        relatedSignals: []
      }
    };

    return defaultPlaybook[type] || {
      rootCauseSummary: "Automated analysis unavailable — manual SRE investigation required.",
      rootCauseDetail: "The incident telemetry fell outside standard templates, and LLM providers are currently unreachable.",
      confidence: "LOW",
      contributingFactors: ["System telemetry breach"],
      immediateActions: ["Tail the stream application logs.", "Open Grafana/Datadog dashboards."],
      investigationSteps: ["Query the signals table in TimescaleDB."],
      preventionRecommendations: ["Review alert thresholds."],
      relatedSignals: []
    };
  }

  private async publishUpdate(incidentId: string, diagnosisId: string) {
    await this.kafkaProducerService.publish('pulseai.incidents.updated', incidentId, {
      incidentId,
      diagnosisId,
      diagnosisReady: true,
    });
  }
}
