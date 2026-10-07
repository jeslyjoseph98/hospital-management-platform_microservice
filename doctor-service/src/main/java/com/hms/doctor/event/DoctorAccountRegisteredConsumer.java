package com.hms.doctor.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.doctor.mapper.DoctorMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumes user.doctor-account-registered { userId, doctorId }.
 * UPDATE doctors SET login_registered = 1 WHERE id = ?. Idempotent: running twice is a no-op the second time.
 */
@Component
public class DoctorAccountRegisteredConsumer {

    private static final Logger log = LoggerFactory.getLogger(DoctorAccountRegisteredConsumer.class);

    private final DoctorMapper doctorMapper;
    private final ObjectMapper objectMapper;

    public DoctorAccountRegisteredConsumer(DoctorMapper doctorMapper, ObjectMapper objectMapper) {
        this.doctorMapper = doctorMapper;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "user.doctor-account-registered", groupId = "doctor-service")
    public void onMessage(String message) {
        try {
            JsonNode root = objectMapper.readTree(message);
            JsonNode payloadNode = root.has("payload") ? root.get("payload") : root;
            DoctorAccountRegisteredPayload payload =
                    objectMapper.treeToValue(payloadNode, DoctorAccountRegisteredPayload.class);

            if (payload.getDoctorId() == null) {
                log.warn("Received user.doctor-account-registered with no doctorId: {}", message);
                return;
            }
            int updated = doctorMapper.updateLoginRegistered(payload.getDoctorId());
            log.info("Processed user.doctor-account-registered for doctorId={} userId={} (rows updated={})",
                    payload.getDoctorId(), payload.getUserId(), updated);
        } catch (Exception e) {
            log.error("Failed to process user.doctor-account-registered message: {}", message, e);
        }
    }
}
