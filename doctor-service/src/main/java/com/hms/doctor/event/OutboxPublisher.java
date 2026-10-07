package com.hms.doctor.event;

import com.hms.doctor.mapper.OutboxEventMapper;
import com.hms.doctor.model.OutboxEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * OB-R1: every 2 seconds, oldest 50 NEW records.
 * OB-R2: send and wait for ack; on ack -> SENT; on failure stop this run, retry next run.
 * OB-R3: a record can be sent more than once; consumers must be idempotent.
 */
@Component
public class OutboxPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);
    private static final int BATCH_SIZE = 50;

    private final OutboxEventMapper outboxEventMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;

    public OutboxPublisher(OutboxEventMapper outboxEventMapper, KafkaTemplate<String, String> kafkaTemplate) {
        this.outboxEventMapper = outboxEventMapper;
        this.kafkaTemplate = kafkaTemplate;
    }

    @Scheduled(fixedDelay = 2000)
    public void publishOutbox() {
        List<OutboxEvent> events = outboxEventMapper.findOldestNew(BATCH_SIZE);
        for (OutboxEvent event : events) {
            try {
                kafkaTemplate.send(event.getTopic(), event.getMessageKey(), event.getPayload())
                        .get(5, TimeUnit.SECONDS);
                outboxEventMapper.markSent(event.getId(), LocalDateTime.now());
            } catch (Exception e) {
                log.warn("Failed to publish outbox event id={} topic={}: {}. Stopping this run; will retry.",
                        event.getId(), event.getTopic(), e.getMessage());
                break;
            }
        }
    }
}
