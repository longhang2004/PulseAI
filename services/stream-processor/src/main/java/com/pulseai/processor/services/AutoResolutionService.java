package com.pulseai.processor.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pulseai.processor.entities.IncidentEntity;
import com.pulseai.processor.repositories.IncidentRepository;
import com.pulseai.processor.anomaly.AnomalyDetectionEngine;
import com.pulseai.processor.anomaly.AnomalyDetector;
import com.pulseai.processor.anomaly.StreamStats;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AutoResolutionService {

    private final IncidentRepository incidentRepository;
    private final AnomalyDetectionEngine anomalyDetectionEngine;
    private final List<AnomalyDetector> detectors;
    private final StringRedisTemplate redisTemplate;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Checks all open incidents every 60 seconds to see if the anomaly conditions have cleared.
     * Requires 3 consecutive clear checks (using a Redis counter) to resolve the incident.
     */
    @Scheduled(fixedDelay = 60000)
    public void evaluateOpenIncidents() {
        List<IncidentEntity> openIncidents = incidentRepository.findByStatus("OPEN");
        if (openIncidents.isEmpty()) return;

        log.info("[Cron] Checking auto-resolution for {} open incidents...", openIncidents.size());

        for (IncidentEntity incident : openIncidents) {
            boolean isConditionCleared = checkAnomalyConditionCleared(incident);

            String redisKey = "pulseai:incident-clear-count:" + incident.getId();

            if (isConditionCleared) {
                // Increment clear counter in Redis
                Long count = 0L;
                try {
                    count = redisTemplate.opsForValue().increment(redisKey);
                } catch (Exception e) {
                    log.error("Failed to increment clear counter in Redis for incident {}", incident.getId(), e);
                    // Fallback to resolve immediately if Redis is unreachable to avoid stuck incidents
                    resolveIncident(incident);
                    continue;
                }

                log.info("Incident {} condition check: clear count = {}", incident.getId(), count);

                if (count != null && count >= 3) {
                    resolveIncident(incident);
                    redisTemplate.delete(redisKey);
                }
            } else {
                // Anomaly still active, reset the clear counter in Redis
                try {
                    redisTemplate.delete(redisKey);
                } catch (Exception e) {
                    log.error("Failed to delete clear counter in Redis for incident {}", incident.getId(), e);
                }
            }
        }
    }

    private boolean checkAnomalyConditionCleared(IncidentEntity incident) {
        String streamId = incident.getStreamId();
        String type = incident.getType();

        // 1. Fetch current stream statistics
        StreamStats stats = anomalyDetectionEngine.getStreamStatsMap().get(streamId);
        if (stats == null) {
            // No recent signals, condition is technically clear
            return true;
        }

        // 2. Fetch the corresponding detector
        Optional<AnomalyDetector> detectorOpt = detectors.stream()
                .filter(d -> d.getType().equals(type))
                .findFirst();

        if (detectorOpt.isEmpty()) {
            // Anomaly type has no detector, assume clear
            return true;
        }

        // 3. Evaluate detector
        AnomalyDetector detector = detectorOpt.get();
        return detector.detect(stats).isEmpty();
    }

    private void resolveIncident(IncidentEntity incident) {
        incident.setStatus("RESOLVED");
        incident.setResolvedAt(OffsetDateTime.now());
        incident.setUpdatedAt(OffsetDateTime.now());
        
        incidentRepository.save(incident);
        log.info("[Auto-Resolution] Incident {} has been marked as RESOLVED", incident.getId());

        // Publish resolved event to Kafka
        publishIncidentResolvedEvent(incident);
    }

    private void publishIncidentResolvedEvent(IncidentEntity incident) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("event", "resolved");
            payload.put("incidentId", incident.getId());
            payload.put("projectId", incident.getProjectId());
            payload.put("streamId", incident.getStreamId());
            payload.put("type", incident.getType());
            payload.put("severity", incident.getSeverity());
            payload.put("status", incident.getStatus());
            payload.put("title", incident.getTitle() + " (RESOLVED)");
            payload.put("detectedAt", incident.getDetectedAt().toString());
            payload.put("resolvedAt", incident.getResolvedAt().toString());
            payload.put("triggerValue", incident.getTriggerValue());
            payload.put("triggerThreshold", incident.getTriggerThreshold());

            String message = objectMapper.writeValueAsString(payload);
            String topic = "pulseai.incidents.resolved";

            kafkaTemplate.send(topic, incident.getId().toString(), message);
        } catch (Exception e) {
            log.error("Failed to publish incident resolved event for {}", incident.getId(), e);
        }
    }
}
