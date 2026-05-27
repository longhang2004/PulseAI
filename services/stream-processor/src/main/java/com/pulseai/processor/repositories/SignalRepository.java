package com.pulseai.processor.repositories;

import com.pulseai.processor.entities.SignalEntity;
import com.pulseai.processor.entities.SignalId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface SignalRepository extends JpaRepository<SignalEntity, SignalId> {

    /**
     * Query signals in the last window (e.g. last 5 minutes) for recovery on startup.
     */
    @Query("SELECT s FROM SignalEntity s WHERE s.timestamp >= :startTime ORDER BY s.timestamp ASC")
    List<SignalEntity> findSignalsForRecovery(@Param("startTime") OffsetDateTime startTime);
}
