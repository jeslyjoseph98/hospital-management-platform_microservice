package com.hms.doctor.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.doctor.mapper.OutboxEventMapper;
import com.hms.doctor.model.OutboxEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * Writes outbox records in the same transaction as the business change (SVC-00 section 8.3).
 * Never calls Kafka directly - that's the job of the scheduled OutboxPublisher.
 */
@Service
public class OutboxService {

    private static final Logger log = LoggerFactory.getLogger(OutboxService.class);

    private final OutboxEventMapper outboxEventMapper;
    private final ObjectMapper objectMapper;

    public OutboxService(OutboxEventMapper outboxEventMapper, ObjectMapper objectMapper) {
        this.outboxEventMapper = outboxEventMapper;
        this.objectMapper = objectMapper;
    }

    public void save(String topic, String messageKey, String eventType, Object payload) {
        try {
            String eventId = UUID.randomUUID().toString();
            EventEnvelope envelope = new EventEnvelope(eventId, eventType, Instant.now().toString(), payload);
            String json = objectMapper.writeValueAsString(envelope);

            OutboxEvent event = new OutboxEvent();
            event.setEventId(eventId);
            event.setTopic(topic);
            event.setMessageKey(messageKey);
            event.setPayload(json);
            event.setStatus("NEW");
            outboxEventMapper.insert(event);
        } catch (Exception e) {
            log.error("Failed to serialize outbox payload for topic {}", topic, e);
            throw new RuntimeException("Failed to write outbox event", e);
        }
    }
}
