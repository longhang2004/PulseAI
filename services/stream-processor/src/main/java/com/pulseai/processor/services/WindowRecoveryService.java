package com.pulseai.processor.services;

import com.pulseai.processor.entities.SignalEntity;
import com.pulseai.processor.repositories.SignalRepository;
import com.pulseai.processor.anomaly.AnomalyDetectionEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class WindowRecoveryService implements CommandLineRunner {

    private final SignalRepository signalRepository;
    private final AnomalyDetectionEngine anomalyDetectionEngine;

    @Override
    public void run(String... args) throws Exception {
        log.info("[Recovery] Starting window state recovery from database...");
        
        // Recover last 5 minutes of signals
        OffsetDateTime recoveryThreshold = OffsetDateTime.now().minusMinutes(5);
        
        try {
            List<SignalEntity> signals = signalRepository.findSignalsForRecovery(recoveryThreshold);
            log.info("[Recovery] Loaded {} signals from TimescaleDB. Populating sliding windows...", signals.size());
            
            for (SignalEntity signal : signals) {
                anomalyDetectionEngine.processSignal(signal);
            }
            
            log.info("[Recovery] Window state recovery completed successfully.");
        } catch (Exception e) {
            log.error("[Recovery] Failed to recover window state from database", e);
        }
    }
}
