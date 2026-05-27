package com.pulseai.processor.anomaly.detectors;

import com.pulseai.processor.anomaly.AnomalyDetector;
import com.pulseai.processor.anomaly.AnomalyResult;
import com.pulseai.processor.anomaly.StreamStats;
import com.pulseai.processor.entities.SignalEntity;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class TraceErrorRateDetector implements AnomalyDetector {

    @Override
    public String getType() {
        return "TRACE_ERROR_RATE";
    }

    @Override
    public Optional<AnomalyResult> detect(StreamStats stats) {
        List<SignalEntity> traceSignals = stats.getRecentSignals().stream()
                .filter(s -> "TRACE".equals(s.getType()))
                .collect(Collectors.toList());

        long totalTraces = traceSignals.size();
        
        // Need a minimum baseline of 10 traces to avoid alerting on sparse/startup samples
        if (totalTraces < 10) {
            return Optional.empty();
        }

        long errorTraces = traceSignals.stream()
                .filter(s -> "ERROR".equals(s.getStatus()))
                .count();

        double errorRate = (double) errorTraces / totalTraces;
        double threshold = 0.05; // 5%

        if (errorRate > threshold) {
            String severity = errorRate > 0.20 ? "HIGH" : "MEDIUM";
            String title = String.format("High trace error rate: %.1f%% of trace spans failed (Total: %d, Failed: %d) on %s",
                    errorRate * 100, totalTraces, errorTraces, stats.getStreamId());

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
