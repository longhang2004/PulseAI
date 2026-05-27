import { ConditionEvaluator } from './condition-evaluator';

describe('ConditionEvaluator', () => {
  let evaluator: ConditionEvaluator;

  beforeEach(() => {
    evaluator = new ConditionEvaluator();
  });

  it('should match any incident if condition is empty', () => {
    const incident = { type: 'ERROR_BURST', severity: 'HIGH', streamId: 'api-prod' };
    const result = evaluator.evaluate(incident, {});
    expect(result).toBe(true);
  });

  it('should filter by incident type', () => {
    const incident = { type: 'ERROR_BURST', severity: 'HIGH', streamId: 'api-prod' };
    
    expect(evaluator.evaluate(incident, { incidentType: 'ERROR_BURST' })).toBe(true);
    expect(evaluator.evaluate(incident, { incidentType: 'LATENCY_DEGRADATION' })).toBe(false);
  });

  it('should filter by streamId', () => {
    const incident = { type: 'ERROR_BURST', severity: 'HIGH', streamId: 'api-prod' };
    
    expect(evaluator.evaluate(incident, { streamId: 'api-prod' })).toBe(true);
    expect(evaluator.evaluate(incident, { streamId: 'auth-prod' })).toBe(false);
  });

  it('should filter by min severity using hierarchy', () => {
    const incident = { type: 'ERROR_BURST', severity: 'HIGH', streamId: 'api-prod' };
    
    // LOW < MEDIUM < HIGH < CRITICAL
    expect(evaluator.evaluate(incident, { minSeverity: 'LOW' })).toBe(true);
    expect(evaluator.evaluate(incident, { minSeverity: 'MEDIUM' })).toBe(true);
    expect(evaluator.evaluate(incident, { minSeverity: 'HIGH' })).toBe(true);
    expect(evaluator.evaluate(incident, { minSeverity: 'CRITICAL' })).toBe(false);
  });

  it('should filter combining multiple criteria', () => {
    const incident = { type: 'ERROR_BURST', severity: 'HIGH', streamId: 'api-prod' };
    
    expect(evaluator.evaluate(incident, { 
      incidentType: 'ERROR_BURST',
      minSeverity: 'MEDIUM',
      streamId: 'api-prod'
    })).toBe(true);

    expect(evaluator.evaluate(incident, { 
      incidentType: 'ERROR_BURST',
      minSeverity: 'CRITICAL',
      streamId: 'api-prod'
    })).toBe(false);
  });
});
