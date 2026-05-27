package com.pulseai.processor.anomaly.detectors;

import com.pulseai.processor.anomaly.AnomalyDetector;
import com.pulseai.processor.anomaly.AnomalyResult;
import com.pulseai.processor.anomaly.StreamStats;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class MetricSpikeDetector implements AnomalyDetector {

    @Override
    public String getType() {
        return "METRIC_SPIKE";
    }

    @Override
    public Optional<AnomalyResult> detect(StreamStats stats) {
        // Iterate through all metric histories in stats
        for (String metricName : stats.getMetricHistories().keySet()) {
            List<Double> values = stats.getMetricHistory(metricName);
            
            // We need at least 4 values (3 baseline, 1 latest to check)
            if (values.size() < 4) continue;

            double latestValue = values.get(values.size() - 1);
            List<Double> baseline = values.subList(0, values.size() - 1);

            // Compute baseline stats
            double mean = calculateMean(baseline);
            double stdDev = calculateStdDev(baseline, mean);

            // Avoid division by zero when standard deviation is very small
            if (stdDev < 0.00001) {
                stdDev = 0.00001;
            }

            double deviation = Math.abs(latestValue - mean);
            double zScore = deviation / stdDev;
            double threshold = 3.0; // 3 standard deviations

            if (zScore > threshold && deviation > 1.0) { // Also ensure actual difference is > 1.0 to prevent noise on tiny floats
                String severity = zScore > 5.0 ? "HIGH" : "MEDIUM";
                String title = String.format("Metric spike: '%s' value %.2f is %.1f std deviations away from mean (Mean: %.2f, StdDev: %.2f) on %s",
                        metricName, latestValue, zScore, mean, stdDev, stats.getStreamId());

                return Optional.of(new AnomalyResult(
                        getType(),
                        severity,
                        title,
                        latestValue,
                        mean + (threshold * stdDev)
                ));
            }
        }

        return Optional.empty();
    }

    private double calculateMean(List<Double> list) {
        double sum = 0;
        for (double d : list) sum += d;
        return sum / list.size();
    }

    private double calculateStdDev(List<Double> list, double mean) {
        double sumSquareDiff = 0;
        for (double d : list) {
            sumSquareDiff += Math.pow(d - mean, 2);
        }
        return Math.sqrt(sumSquareDiff / list.size());
    }
}
