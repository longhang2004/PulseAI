package com.pulseai.processor.anomaly;

import com.pulseai.processor.anomaly.detectors.ErrorBurstDetector;
import com.pulseai.processor.anomaly.detectors.ErrorRateSpikeDetector;
import com.pulseai.processor.anomaly.detectors.MetricSpikeDetector;
import com.pulseai.processor.entities.SignalEntity;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class AnomalyDetectorTest {

    @Test
    void testErrorRateSpikeDetector_Triggers() {
        StreamStats stats = new StreamStats("test-stream");
        UUID projectId = UUID.randomUUID();

        // Add 12 ERROR log signals (total 12 signals, error rate = 100%)
        for (int i = 0; i < 12; i++) {
            SignalEntity signal = SignalEntity.builder()
                    .signalId(UUID.randomUUID())
                    .projectId(projectId)
                    .streamId("test-stream")
                    .type("LOG")
                    .level("ERROR")
                    .timestamp(OffsetDateTime.now())
                    .build();
            stats.addSignal(signal);
        }

        ErrorRateSpikeDetector detector = new ErrorRateSpikeDetector();
        Optional<AnomalyResult> result = detector.detect(stats);

        assertTrue(result.isPresent());
        assertEquals("ERROR_RATE_SPIKE", result.get().getType());
        assertEquals(100.0, result.get().getTriggerValue());
    }

    @Test
    void testErrorRateSpikeDetector_NoTrigger_LowCount() {
        StreamStats stats = new StreamStats("test-stream");
        UUID projectId = UUID.randomUUID();

        // Add only 5 ERROR signals (threshold is > 10 errors)
        for (int i = 0; i < 5; i++) {
            SignalEntity signal = SignalEntity.builder()
                    .signalId(UUID.randomUUID())
                    .projectId(projectId)
                    .streamId("test-stream")
                    .type("LOG")
                    .level("ERROR")
                    .timestamp(OffsetDateTime.now())
                    .build();
            stats.addSignal(signal);
        }

        ErrorRateSpikeDetector detector = new ErrorRateSpikeDetector();
        Optional<AnomalyResult> result = detector.detect(stats);

        assertFalse(result.isPresent());
    }

    @Test
    void testErrorBurstDetector_Triggers() {
        StreamStats stats = new StreamStats("test-stream");
        UUID projectId = UUID.randomUUID();

        // Add 55 ERROR log signals in the last minute (threshold is > 50)
        for (int i = 0; i < 55; i++) {
            SignalEntity signal = SignalEntity.builder()
                    .signalId(UUID.randomUUID())
                    .projectId(projectId)
                    .streamId("test-stream")
                    .type("LOG")
                    .level("ERROR")
                    .timestamp(OffsetDateTime.now())
                    .build();
            stats.addSignal(signal);
        }

        ErrorBurstDetector detector = new ErrorBurstDetector();
        Optional<AnomalyResult> result = detector.detect(stats);

        assertTrue(result.isPresent());
        assertEquals("ERROR_BURST", result.get().getType());
        assertEquals(55.0, result.get().getTriggerValue());
    }

    @Test
    void testMetricSpikeDetector_Triggers() {
        StreamStats stats = new StreamStats("test-stream");
        UUID projectId = UUID.randomUUID();
        String metricName = "cpu_usage";

        // Baseline metric values: 10.0, 10.2, 9.8, 10.1 (Mean is ~10.0, StdDev is very small)
        double[] baseline = { 10.0, 10.2, 9.8, 10.0, 10.1, 9.9 };
        for (double val : baseline) {
            SignalEntity signal = SignalEntity.builder()
                    .signalId(UUID.randomUUID())
                    .projectId(projectId)
                    .streamId("test-stream")
                    .type("METRIC")
                    .metricName(metricName)
                    .metricValue(val)
                    .timestamp(OffsetDateTime.now())
                    .build();
            stats.addSignal(signal);
        }

        // Add a huge spike value: 50.0 (baseline mean is 10.0, stdDev is ~0.13, so 50 is > 300 stdDevs away!)
        SignalEntity spike = SignalEntity.builder()
                .signalId(UUID.randomUUID())
                .projectId(projectId)
                .streamId("test-stream")
                .type("METRIC")
                .metricName(metricName)
                .metricValue(50.0)
                .timestamp(OffsetDateTime.now())
                .build();
        stats.addSignal(spike);

        MetricSpikeDetector detector = new MetricSpikeDetector();
        Optional<AnomalyResult> result = detector.detect(stats);

        assertTrue(result.isPresent());
        assertEquals("METRIC_SPIKE", result.get().getType());
        assertEquals(50.0, result.get().getTriggerValue());
    }
}
