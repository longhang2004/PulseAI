package com.pulseai.processor.anomaly.detectors;

import com.pulseai.processor.anomaly.AnomalyDetector;
import com.pulseai.processor.anomaly.AnomalyResult;
import com.pulseai.processor.anomaly.StreamStats;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class ErrorRateSpikeDetector implements AnomalyDetector {

    @Override
    public String getType() {
        return "ERROR_RATE_SPIKE";
    }

    @Override
    public Optional<AnomalyResult> detect(StreamStats stats) {
        double errorRate = stats.getErrorRateLast1Min();
        long errorCount = stats.getErrorCountLast1Min();
        
        double threshold = 0.10; // 10%
        
        if (errorRate > threshold && errorCount > 10) {
            String severity = errorRate > 0.30 ? "CRITICAL" : "HIGH";
            String title = String.format("High error rate detected: %.1f%% on %s", errorRate * 100, stats.getStreamId());
            
            return Optional.of(new AnomalyResult(
                    getType(),
                    severity,
                    title,
                    errorRate * 100,
                    threshold * 100
            ));
        }
        
        return Optional.empty();
    }
}
