package com.pulseai.processor.anomaly;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pulseai.processor.entities.IncidentEntity;
import com.pulseai.processor.entities.SignalEntity;
import com.pulseai.processor.repositories.IncidentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnomalyDetectionEngine {

    private final List<AnomalyDetector> detectors;
    private final IncidentRepository incidentRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Getter
    private final Map<String, StreamStats> streamStatsMap = new ConcurrentHashMap<>();

    /**
     * Entrypoint for processing a new signal.
     */
    public void processSignal(SignalEntity signal) {
        String streamId = signal.getStreamId();
        StreamStats stats = streamStatsMap.computeIfAbsent(streamId, StreamStats::new);
        
        // 1. Update in-memory sliding window stats
        stats.addSignal(signal);

        // 2. Evaluate all anomaly detectors
        for (AnomalyDetector detector : detectors) {
            // SilenceDetector is run periodically on a cron, not on signal arrival
            if ("SILENCE".equals(detector.getType())) {
                continue;
            }
            
            evaluateDetector(detector, stats, signal.getProjectId());
        }
    }

    /**
     * Periodically evaluate SilenceDetector across all active streams.
     * Runs every 10 seconds.
     */
    @Scheduled(fixedDelay = 10000)
    public void runSilenceDetection() {
        Optional<AnomalyDetector> silenceDetectorOpt = detectors.stream()
                .filter(d -> "SILENCE".equals(d.getType()))
                .findFirst();

        if (silenceDetectorOpt.isEmpty()) return;
        AnomalyDetector silenceDetector = silenceDetectorOpt.get();

        for (StreamStats stats : streamStatsMap.values()) {
            // Find project ID of the last signal to use for incident mapping
            SignalEntity lastSignal = stats.getRecentSignals().peekLast();
            UUID projectId = lastSignal != null ? lastSignal.getProjectId() : null;

            if (projectId != null) {
                evaluateDetector(silenceDetector, stats, projectId);
            }
        }
    }

    private void evaluateDetector(AnomalyDetector detector, StreamStats stats, UUID projectId) {
        try {
            Optional<AnomalyResult> resultOpt = detector.detect(stats);
            if (resultOpt.isPresent()) {
                handleAnomaly(resultOpt.get(), stats.getStreamId(), projectId);
            }
        } catch (Exception e) {
            log.error("Error evaluating detector {} on stream {}", detector.getType(), stats.getStreamId(), e);
        }
    }

    private void handleAnomaly(AnomalyResult anomaly, String streamId, UUID projectId) {
        // Check if an open incident already exists for this stream and anomaly type
        Optional<IncidentEntity> existingIncidentOpt = incidentRepository
                .findFirstByStreamIdAndTypeAndStatus(streamId, anomaly.getType(), "OPEN");

        if (existingIncidentOpt.isEmpty()) {
            // 1. Create a new incident
            UUID incidentId = UUID.randomUUID();
            IncidentEntity newIncident = IncidentEntity.builder()
                    .id(incidentId)
                    .projectId(projectId)
                    .streamId(streamId)
                    .type(anomaly.getType())
                    .severity(anomaly.getSeverity())
                    .status("OPEN")
                    .title(anomaly.getTitle())
                    .detectedAt(OffsetDateTime.now())
                    .triggerValue(anomaly.getTriggerValue())
                    .triggerThreshold(anomaly.getTriggerThreshold())
                    .signalWindowStart(OffsetDateTime.now().minusMinutes(5))
                    .signalWindowEnd(OffsetDateTime.now())
                    .build();

            incidentRepository.save(newIncident);
            log.warn("Created new incident: {}", anomaly.getTitle());

            // Publish 'created' event to Kafka
            publishIncidentEvent(newIncident, "created");
        } else {
            // 2. Update existing incident
            IncidentEntity incident = existingIncidentOpt.get();
            incident.setTriggerValue(anomaly.getTriggerValue());
            incident.setUpdatedAt(OffsetDateTime.now());
            
            incidentRepository.save(incident);
            log.info("Updated existing incident: {}", anomaly.getTitle());

            // Publish 'updated' event to Kafka
            publishIncidentEvent(incident, "updated");
        }
    }

    private void publishIncidentEvent(IncidentEntity incident, String eventType) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("event", eventType);
            payload.put("incidentId", incident.getId());
            payload.put("projectId", incident.getProjectId());
            payload.put("streamId", incident.getStreamId());
            payload.put("type", incident.getType());
            payload.put("severity", incident.getSeverity());
            payload.put("status", incident.getStatus());
            payload.put("title", incident.getTitle());
            payload.put("detectedAt", incident.getDetectedAt().toString());
            payload.put("triggerValue", incident.getTriggerValue());
            payload.put("triggerThreshold", incident.getTriggerThreshold());

            String message = objectMapper.writeValueAsString(payload);
            String topic = "pulseai.incidents." + eventType;

            kafkaTemplate.send(topic, incident.getId().toString(), message);
        } catch (Exception e) {
            log.error("Failed to publish incident event for incident {}", incident.getId(), e);
        }
    }
}
