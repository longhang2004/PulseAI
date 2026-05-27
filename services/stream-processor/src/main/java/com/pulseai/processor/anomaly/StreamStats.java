package com.pulseai.processor.anomaly;

import com.pulseai.processor.entities.SignalEntity;
import lombok.Getter;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.stream.Collectors;

@Getter
public class StreamStats {
    private final String streamId;
    
    // Slide window queue of signals in the last 5 minutes
    private final ConcurrentLinkedDeque<SignalEntity> recentSignals = new ConcurrentLinkedDeque<>();
    
    // Last signal timestamp received
    private OffsetDateTime lastSignalTime;
    
    // Last 10 values per metric name
    private final Map<String, ConcurrentLinkedDeque<Double>> metricHistories = new ConcurrentHashMap<>();

    public StreamStats(String streamId) {
        this.streamId = streamId;
    }

    public synchronized void addSignal(SignalEntity signal) {
        recentSignals.add(signal);
        lastSignalTime = signal.getTimestamp();

        // If it's a metric signal, update metric history
        if ("METRIC".equals(signal.getType()) && signal.getMetricName() != null && signal.getMetricValue() != null) {
            metricHistories.computeIfAbsent(signal.getMetricName(), k -> new ConcurrentLinkedDeque<>())
                    .add(signal.getMetricValue());
            
            // Limit to last 10 values
            ConcurrentLinkedDeque<Double> history = metricHistories.get(signal.getMetricName());
            while (history.size() > 10) {
                history.poll();
            }
        }

        // Clean up signals older than 5 minutes
        trimOldSignals();
    }

    private void trimOldSignals() {
        if (recentSignals.isEmpty()) return;
        OffsetDateTime threshold = OffsetDateTime.now().minusMinutes(5);
        
        while (!recentSignals.isEmpty()) {
            SignalEntity first = recentSignals.peekFirst();
            if (first != null && first.getTimestamp().isBefore(threshold)) {
                recentSignals.pollFirst();
            } else {
                break;
            }
        }
    }

    // --- Statistics Helpers ---

    public synchronized long getSignalCountLast1Min() {
        OffsetDateTime oneMinAgo = OffsetDateTime.now().minusMinutes(1);
        return recentSignals.stream()
                .filter(s -> s.getTimestamp().isAfter(oneMinAgo))
                .count();
    }

    public synchronized long getSignalCountLast5Min() {
        return recentSignals.size();
    }

    public synchronized long getErrorCountLast1Min() {
        OffsetDateTime oneMinAgo = OffsetDateTime.now().minusMinutes(1);
        return recentSignals.stream()
                .filter(s -> s.getTimestamp().isAfter(oneMinAgo))
                .filter(s -> {
                    if ("LOG".equals(s.getType())) {
                        return "ERROR".equals(s.getLevel()) || "FATAL".equals(s.getLevel());
                    } else if ("TRACE".equals(s.getType())) {
                        return "ERROR".equals(s.getStatus());
                    }
                    return false;
                })
                .count();
    }

    public synchronized double getErrorRateLast1Min() {
        long total = getSignalCountLast1Min();
        if (total == 0) return 0.0;
        return (double) getErrorCountLast1Min() / total;
    }

    /**
     * Calculates trace latency percentiles (P50, P95, P99) for traces in the last 5 minutes.
     */
    public synchronized LatencyPercentiles getLatencyPercentilesLast5Min() {
        List<Long> durations = recentSignals.stream()
                .filter(s -> "TRACE".equals(s.getType()) && s.getDurationMs() != null)
                .map(SignalEntity::getDurationMs)
                .collect(Collectors.toList());

        if (durations.isEmpty()) {
            return new LatencyPercentiles(0L, 0L, 0L);
        }

        Collections.sort(durations);
        int size = durations.size();

        long p50 = durations.get((int) (size * 0.50));
        long p95 = durations.get((int) (size * 0.95));
        long p99 = durations.get((int) (size * 0.99));

        return new LatencyPercentiles(p50, p95, p99);
    }

    public synchronized List<Double> getMetricHistory(String metricName) {
        ConcurrentLinkedDeque<Double> history = metricHistories.get(metricName);
        if (history == null) return Collections.emptyList();
        return new ArrayList<>(history);
    }

    @Getter
    @AllArgsConstructor
    public static class LatencyPercentiles {
        private final long p50;
        private final long p95;
        private final long p99;
    }
}
