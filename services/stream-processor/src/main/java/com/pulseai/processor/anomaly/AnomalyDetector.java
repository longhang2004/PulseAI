package com.pulseai.processor.anomaly;

import java.util.Optional;

public interface AnomalyDetector {
    /**
     * Unique anomaly type string (e.g. ERROR_RATE_SPIKE).
     */
    String getType();

    /**
     * Analyzes stream statistics to detect anomalies.
     * Returns Optional containing AnomalyResult if triggered.
     */
    Optional<AnomalyResult> detect(StreamStats stats);
}
