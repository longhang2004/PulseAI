package com.pulseai.processor.consumers;

import com.pulseai.processor.dto.SignalDto;
import com.pulseai.processor.entities.SignalEntity;
import com.pulseai.processor.repositories.SignalRepository;
import com.pulseai.processor.anomaly.AnomalyDetectionEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SignalConsumer {

    private final SignalRepository signalRepository;
    private final AnomalyDetectionEngine anomalyDetectionEngine;

    @KafkaListener(topics = "pulseai.signals.log", containerFactory = "kafkaListenerContainerFactory", groupId = "log-processor-group")
    public void consumeLog(SignalDto dto) {
        processSignalDto(dto);
    }

    @KafkaListener(topics = "pulseai.signals.metric", containerFactory = "kafkaListenerContainerFactory", groupId = "metric-processor-group")
    public void consumeMetric(SignalDto dto) {
        processSignalDto(dto);
    }

    @KafkaListener(topics = "pulseai.signals.trace", containerFactory = "kafkaListenerContainerFactory", groupId = "trace-processor-group")
    public void consumeTrace(SignalDto dto) {
        processSignalDto(dto);
    }

    private void processSignalDto(SignalDto dto) {
        try {
            SignalEntity entity = convertToEntity(dto);
            
            // 1. Persist to TimescaleDB
            signalRepository.save(entity);

            // 2. Feed to Anomaly Detection Engine
            anomalyDetectionEngine.processSignal(entity);
            
        } catch (Exception e) {
            log.error("Failed to process signal from Kafka: {}", dto, e);
        }
    }

    private SignalEntity convertToEntity(SignalDto dto) {
        OffsetDateTime timestamp = parseDateTime(dto.getTimestamp());
        OffsetDateTime receivedAt = parseDateTime(dto.getReceivedAt());

        Map<String, Object> attributes = dto.getAttributes();
        if (attributes == null) {
            attributes = new HashMap<>();
        }
        
        // For METRIC, merge tags into attributes
        if ("METRIC".equals(dto.getType()) && dto.getTags() != null) {
            attributes.putAll(dto.getTags());
        }

        return SignalEntity.builder()
                .signalId(dto.getSignalId())
                .timestamp(timestamp)
                .projectId(dto.getProjectId())
                .streamId(dto.getStreamId())
                .type(dto.getType())
                .receivedAt(receivedAt)
                .level(dto.getLevel())
                .message(dto.getMessage())
                .metricName(dto.getMetricName())
                .metricValue(dto.getValue())
                .metricUnit(dto.getUnit())
                .traceId(dto.getTraceId())
                .spanId(dto.getSpanId())
                .parentSpanId(dto.getParentSpanId())
                .operationName(dto.getOperationName())
                .durationMs(dto.getDurationMs())
                .status(dto.getStatus())
                .attributes(attributes)
                .build();
    }

    private OffsetDateTime parseDateTime(String isoString) {
        if (isoString == null) {
            return OffsetDateTime.now(ZoneOffset.UTC);
        }
        return OffsetDateTime.parse(isoString, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }
}
