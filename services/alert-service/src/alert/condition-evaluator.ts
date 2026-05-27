import { Injectable } from '@nestjs/common';

const SEVERITY_LEVELS: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

@Injectable()
export class ConditionEvaluator {
  evaluate(incident: { type: string; severity: string; streamId: string }, condition: { incidentType?: string; minSeverity?: string; streamId?: string; anyIncident?: boolean }): boolean {
    if (!condition) return false;

    // Check incident type if configured
    if (condition.incidentType && condition.incidentType !== incident.type) {
      return false;
    }

    // Check stream ID if configured
    if (condition.streamId && condition.streamId !== incident.streamId) {
      return false;
    }

    // Check min severity if configured
    if (condition.minSeverity) {
      const incidentWeight = SEVERITY_LEVELS[incident.severity.toUpperCase()] ?? 0;
      const ruleWeight = SEVERITY_LEVELS[condition.minSeverity.toUpperCase()] ?? 0;
      if (incidentWeight < ruleWeight) {
        return false;
      }
    }

    return true;
  }
}
