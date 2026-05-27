export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastStateChange: number = Date.now();

  constructor(
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 120000 // 2 minutes
  ) {}

  getState(): CircuitState {
    this.checkCooldown();
    return this.state;
  }

  private checkCooldown() {
    if (this.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.lastStateChange;
      if (elapsed >= this.cooldownMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }
  }

  private transitionTo(newState: CircuitState) {
    console.log(`[CircuitBreaker] Transitioning state from ${this.state} to ${newState}`);
    this.state = newState;
    this.lastStateChange = Date.now();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkCooldown();

    if (this.state === CircuitState.OPEN) {
      throw new Error('Circuit breaker is OPEN. LLM calls are temporarily blocked.');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.CLOSED);
    }
  }

  private onFailure(error: any) {
    this.failureCount++;
    console.error(`[CircuitBreaker] Failure recorded (${this.failureCount}/${this.failureThreshold}):`, error.message || error);

    if (this.state === CircuitState.CLOSED && this.failureCount >= this.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN); // Immediately re-open on failure in half-open state
    }
  }
}
