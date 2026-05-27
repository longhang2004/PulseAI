package com.pulseai.processor.anomaly.detectors;

import com.pulseai.processor.anomaly.AnomalyDetector;
import com.pulseai.processor.anomaly.AnomalyResult;
import com.pulseai.processor.anomaly.StreamStats;
import com.pulseai.processor.entities.SignalEntity;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class LatencyDegradationDetector implements AnomalyDetector {

    @Override
    public String getType() {
        return "LATENCY_DEGRADATION";
    }

    @Override
    public Optional<AnomalyResult> detect(StreamStats stats) {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime midPoint = now.minusSeconds(150); // 2.5 minutes ago
        OffsetDateTime fiveMinsAgo = now.minusMinutes(5);

        // 1. Calculate P95 of recent window (last 2.5 mins)
        List<Long> recentDurations = stats.getRecentSignals().stream()
                .filter(s -> s.getTimestamp().isAfter(midPoint))
                .filter(s -> "TRACE".equals(s.getType()) && s.getDurationMs() != null)
                .map(SignalEntity::getDurationMs)
                .sorted()
                .collect(Collectors.toList());

        // 2. Calculate P95 of baseline window (5 mins to 2.5 mins ago)
        List<Long> baselineDurations = stats.getRecentSignals().stream()
                .filter(s -> s.getTimestamp().isAfter(fiveMinsAgo) && s.getTimestamp().isBefore(midPoint))
                .filter(s -> "TRACE".equals(s.getType()) && s.getDurationMs() != null)
                .map(SignalEntity::getDurationMs)
                .sorted()
                .collect(Collectors.toList());

        if (recentDurations.isEmpty() || baselineDurations.isEmpty()) {
            return Optional.empty();
        }

        long p95Recent = recentDurations.get((int) (recentDurations.size() * 0.95));
        long p95Baseline = baselineDurations.get((int) (baselineDurations.size() * 0.95));

        if (p95Baseline == 0) return Optional.empty();

        double increasePct = (double) (p95Recent - p95Baseline) / p95Baseline;
        double threshold = 2.0; // 200% increase

        if (increasePct > threshold) {
            String severity = increasePct > 5.0 ? "CRITICAL" : "HIGH";
            String title = String.format("Trace latency P95 degraded by %.0f%% (Baseline: %dms, Current: %dms) on %s",
                    increasePct * 100, p95Baseline, p95Recent, stats.getStreamId());

            return Optional.of(new AnomalyResult(
                    getType(),
                    severity,
                    title,
                    increasePct * 100,
                    threshold * 100
            ));
        }

        return Optional.empty();
    }
}
