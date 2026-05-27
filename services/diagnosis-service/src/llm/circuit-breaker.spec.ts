import { CircuitBreaker, CircuitState } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    // 3 failures, 100ms cooldown for fast test
    breaker = new CircuitBreaker(3, 100);
  });

  it('should start in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should execute successfully when functions succeed', async () => {
    const fn = jest.fn().mockResolvedValue('success-payload');
    const result = await breaker.execute(fn);

    expect(result).toBe('success-payload');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should open after 3 consecutive failures', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('api error'));

    // 1st failure
    await expect(breaker.execute(fn)).rejects.toThrow('api error');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // 2nd failure
    await expect(breaker.execute(fn)).rejects.toThrow('api error');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // 3rd failure (trips the breaker)
    await expect(breaker.execute(fn)).rejects.toThrow('api error');
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // 4th call should be immediately blocked without calling the function
    const blockedFn = jest.fn();
    await expect(breaker.execute(blockedFn)).rejects.toThrow('Circuit breaker is OPEN');
    expect(blockedFn).not.toHaveBeenCalled();
  });

  it('should transition to HALF_OPEN after cooldown and CLOSE on success', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('api error'));
    
    // Fail 3 times to open breaker
    await expect(breaker.execute(fn)).rejects.toThrow('api error');
    await expect(breaker.execute(fn)).rejects.toThrow('api error');
    await expect(breaker.execute(fn)).rejects.toThrow('api error');
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Wait 150ms for cooldown (cooldown set to 100ms)
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    // Success call in HALF_OPEN resets to CLOSED
    const successFn = jest.fn().mockResolvedValue('recovered');
    const result = await breaker.execute(successFn);
    
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });
});
