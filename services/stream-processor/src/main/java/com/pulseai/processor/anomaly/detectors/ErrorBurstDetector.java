package com.pulseai.processor.anomaly.detectors;

import com.pulseai.processor.anomaly.AnomalyDetector;
import com.pulseai.processor.anomaly.AnomalyResult;
import com.pulseai.processor.anomaly.StreamStats;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.Optional;

@Component
public class ErrorBurstDetector implements AnomalyDetector {

    @Override
    public String getType() {
        return "ERROR_BURST";
    }

    @Override
    public Optional<AnomalyResult> detect(StreamStats stats) {
        OffsetDateTime oneMinAgo = OffsetDateTime.now().minusMinutes(1);
        
        long errorLogsCount = stats.getRecentSignals().stream()
                .filter(s -> s.getTimestamp().isAfter(oneMinAgo))
                .filter(s -> "LOG".equals(s.getType()))
                .filter(s -> "ERROR".equals(s.getLevel()) || "FATAL".equals(s.getLevel()))
                .count();

        double threshold = 50.0;
        
        if (errorLogsCount > threshold) {
            String severity = errorLogsCount > 150 ? "CRITICAL" : "HIGH";
            String title = String.format("Error burst: %d error logs in the last 60 seconds on %s", errorLogsCount, stats.getStreamId());
            
            return Optional.of(new AnomalyResult(
                    getType(),
                    severity,
                    title,
                    (double) errorLogsCount,
                    threshold
            ));
        }
        
        return Optional.empty();
    }
}
