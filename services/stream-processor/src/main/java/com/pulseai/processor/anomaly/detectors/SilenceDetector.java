package com.pulseai.processor.anomaly.detectors;

import com.pulseai.processor.anomaly.AnomalyDetector;
import com.pulseai.processor.anomaly.AnomalyResult;
import com.pulseai.processor.anomaly.StreamStats;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;

@Component
public class SilenceDetector implements AnomalyDetector {

    @Override
    public String getType() {
        return "SILENCE";
    }

    @Override
    public Optional<AnomalyResult> detect(StreamStats stats) {
        OffsetDateTime lastSignal = stats.getLastSignalTime();
        if (lastSignal == null) {
            return Optional.empty();
        }

        long minutesSilent = Duration.between(lastSignal, OffsetDateTime.now()).toMinutes();
        double threshold = 5.0; // 5 minutes

        if (minutesSilent >= threshold) {
            String severity = "HIGH";
            String title = String.format("Stream silence: no signals received for %d minutes on stream %s",
                    minutesSilent, stats.getStreamId());

            return Optional.of(new AnomalyResult(
                    getType(),
                    severity,
                    title,
                    (double) minutesSilent,
                    threshold
            ));
        }

        return Optional.empty();
    }
}
