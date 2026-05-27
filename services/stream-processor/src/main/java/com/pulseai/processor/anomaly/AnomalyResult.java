package com.pulseai.processor.anomaly;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AnomalyResult {
    private final String type; // e.g., ERROR_BURST, LATENCY_DEGRADATION
    private final String severity; // LOW | MEDIUM | HIGH | CRITICAL
    private final String title;
    private final double triggerValue;
    private final double triggerThreshold;
}
