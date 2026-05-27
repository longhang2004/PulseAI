package com.pulseai.processor.entities;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

public class SignalId implements Serializable {
    private UUID signalId;
    private OffsetDateTime timestamp;

    public SignalId() {}

    public SignalId(UUID signalId, OffsetDateTime timestamp) {
        this.signalId = signalId;
        this.timestamp = timestamp;
    }

    public UUID getSignalId() {
        return signalId;
    }

    public void setSignalId(UUID signalId) {
        this.signalId = signalId;
    }

    public OffsetDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(OffsetDateTime timestamp) {
        this.timestamp = timestamp;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SignalId signalId1 = (SignalId) o;
        return Objects.equals(signalId, signalId1.signalId) && 
               Objects.equals(timestamp, signalId1.timestamp);
    }

    @Override
    public int hashCode() {
        return Objects.hash(signalId, timestamp);
    }
}
