package com.pulseai.processor.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SignalDto {
    private String type; // LOG | METRIC | TRACE
    private UUID signalId;
    private UUID projectId;
    private String streamId;
    private String timestamp; // ISO 8601 string
    private String receivedAt; // ISO 8601 string

    // LOG
    private String level;
    private String message;

    // METRIC
    private String name;
    private Double value;
    private String unit;
    private Map<String, Object> tags; // tags map to attributes in DB

    // TRACE
    private String traceId;
    private String spanId;
    private String parentSpanId;
    private String operationName;
    private Long durationMs;
    private String status;

    // Shared Attributes
    private Map<String, Object> attributes;
}
