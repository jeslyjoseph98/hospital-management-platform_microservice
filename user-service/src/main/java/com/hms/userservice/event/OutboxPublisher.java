package com.hms.userservice.event;

import com.hms.userservice.domain.OutboxEvent;
import com.hms.userservice.mapper.OutboxEventMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Scheduled outbox publisher job, per SVC-00 OB-R1..OB-R3.
 * Every 2s: oldest 50 NEW rows; send and wait for Kafka ack; on ack mark SENT;
 * on failure stop this run (remaining rows retried next run).
 */
@Component
public class OutboxPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);
    private static final int BATCH_SIZE = 50;
    private static final long SEND_ACK_TIMEOUT_SECONDS = 10;

    private final OutboxEventMapper outboxEventMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;

    public OutboxPublisher(OutboxEventMapper outboxEventMapper, KafkaTemplate<String, String> kafkaTemplate) {
        this.outboxEventMapper = outboxEventMapper;
        this.kafkaTemplate = kafkaTemplate;
    }

    @Scheduled(fixedDelay = 2000)
    public void publishPending() {
        List<OutboxEvent> batch = outboxEventMapper.findOldestNew(BATCH_SIZE);
        for (OutboxEvent event : batch) {
            try {
                String envelope = buildEnvelope(event);
                kafkaTemplate.send(event.getTopic(), event.getMessageKey(), envelope)
                        .get(SEND_ACK_TIMEOUT_SECONDS, TimeUnit.SECONDS);
                outboxEventMapper.markSent(event.getId());
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.warn("Outbox publish interrupted, stopping this run. eventId={}", event.getEventId(), ie);
                return;
            } catch (ExecutionException | TimeoutException | RuntimeException e) {
                log.warn("Failed to publish outbox event {}, stopping this run; will retry next run",
                        event.getEventId(), e);
                return;
            }
        }
    }

    private String buildEnvelope(OutboxEvent event) {
        // payload is already a JSON string (stored as MySQL JSON column); embed it raw.
        return "{"
                + "\"eventId\":\"" + event.getEventId() + "\","
                + "\"eventType\":\"" + event.getTopic() + "\","
                + "\"occurredAt\":\"" + Instant.now().toString() + "\","
                + "\"payload\":" + event.getPayload()
                + "}";
    }
}
