package com.pulseai.processor.repositories;

import com.pulseai.processor.entities.IncidentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface IncidentRepository extends JpaRepository<IncidentEntity, UUID> {

    /**
     * Check if an active open incident already exists for this stream and anomaly type.
     */
    Optional<IncidentEntity> findFirstByStreamIdAndTypeAndStatus(String streamId, String type, String status);

    /**
     * List all open incidents (e.g. status = 'OPEN') for resolution checks.
     */
    List<IncidentEntity> findByStatus(String status);
}
