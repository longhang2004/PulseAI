package com.pulseai.processor.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "signals")
@IdClass(SignalId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SignalEntity {

    @Id
    @Column(name = "signal_id", nullable = false)
    private UUID signalId;

    @Id
    @Column(name = "timestamp", nullable = false)
    private OffsetDateTime timestamp;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "stream_id", nullable = false)
    private String streamId;

    @Column(name = "type", nullable = false)
    private String type; // LOG | METRIC | TRACE

    @Column(name = "received_at", nullable = false)
    private OffsetDateTime receivedAt;

    // --- LOG specific ---
    @Column(name = "level")
    private String level; // DEBUG | INFO | WARN | ERROR | FATAL

    @Column(name = "message")
    private String message;

    // --- METRIC specific ---
    @Column(name = "metric_name")
    private String metricName;

    @Column(name = "metric_value")
    private Double metricValue;

    @Column(name = "metric_unit")
    private String metricUnit;

    // --- TRACE specific ---
    @Column(name = "trace_id")
    private String traceId;

    @Column(name = "span_id")
    private String spanId;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "status")
    private String status; // OK | ERROR

    @Column(name = "operation_name")
    private String operationName;

    // --- Shared Dynamic attributes ---
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attributes", columnDefinition = "jsonb")
    private Map<String, Object> attributes;
}
