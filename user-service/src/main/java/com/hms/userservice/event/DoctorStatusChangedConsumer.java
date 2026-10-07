package com.hms.userservice.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.userservice.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumes doctor.status-changed (SVC-02 section 9). Idempotent: runs an UPDATE keyed
 * on doctor_id; running it twice is a no-op the second time. 0 rows affected
 * (doctor not registered yet) is ignored, not an error.
 */
@Component
public class DoctorStatusChangedConsumer {

    private static final Logger log = LoggerFactory.getLogger(DoctorStatusChangedConsumer.class);

    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    public DoctorStatusChangedConsumer(UserMapper userMapper, ObjectMapper objectMapper) {
        this.userMapper = userMapper;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "doctor.status-changed", groupId = "user-service")
    public void onMessage(String message) {
        try {
            JsonNode root = objectMapper.readTree(message);
            JsonNode payloadNode = root.has("payload") ? root.get("payload") : root;
            DoctorStatusChangedPayload payload = objectMapper.treeToValue(payloadNode, DoctorStatusChangedPayload.class);

            if (payload.getDoctorId() == null) {
                log.warn("doctor.status-changed message missing doctorId, ignoring: {}", message);
                return;
            }

            int updated = userMapper.updateActiveByDoctorId(payload.getDoctorId(), payload.isActive());
            if (updated == 0) {
                log.info("doctor.status-changed: no user registered yet for doctorId={}, ignoring", payload.getDoctorId());
            } else {
                log.info("doctor.status-changed: set is_active={} for doctorId={}", payload.isActive(), payload.getDoctorId());
            }
        } catch (Exception e) {
            log.error("Failed to process doctor.status-changed message: {}", message, e);
        }
    }
}
