package com.pulseai.processor.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "incidents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncidentEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "stream_id", nullable = false)
    private String streamId;

    @Column(name = "type", nullable = false)
    private String type; // e.g., ERROR_RATE_SPIKE, ERROR_BURST, LATENCY_DEGRADATION, etc.

    @Column(name = "severity", nullable = false)
    private String severity; // LOW | MEDIUM | HIGH | CRITICAL

    @Column(name = "status", nullable = false)
    private String status; // OPEN | INVESTIGATING | RESOLVED | IGNORED

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "detected_at", nullable = false)
    private OffsetDateTime detectedAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "trigger_value", nullable = false)
    private Double triggerValue;

    @Column(name = "trigger_threshold", nullable = false)
    private Double triggerThreshold;

    @Column(name = "signal_window_start")
    private OffsetDateTime signalWindowStart;

    @Column(name = "signal_window_end")
    private OffsetDateTime signalWindowEnd;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
