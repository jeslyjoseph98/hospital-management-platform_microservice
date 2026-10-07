package com.hms.userservice.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.userservice.domain.OutboxEvent;
import com.hms.userservice.mapper.OutboxEventMapper;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Writes an outbox row in the caller's (business) transaction. Never calls Kafka directly —
 * see SVC-00 section 8.3.
 */
@Component
public class OutboxEventWriter {

    private final OutboxEventMapper outboxEventMapper;
    private final ObjectMapper objectMapper;

    public OutboxEventWriter(OutboxEventMapper outboxEventMapper, ObjectMapper objectMapper) {
        this.outboxEventMapper = outboxEventMapper;
        this.objectMapper = objectMapper;
    }

    public void write(String topic, String messageKey, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            OutboxEvent event = new OutboxEvent();
            event.setEventId(UUID.randomUUID().toString());
            event.setTopic(topic);
            event.setMessageKey(messageKey);
            event.setPayload(json);
            outboxEventMapper.insert(event);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize outbox payload for topic " + topic, e);
        }
    }
}
