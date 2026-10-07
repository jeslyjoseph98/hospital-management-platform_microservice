package com.hms.userservice.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.userservice.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * SVC-02 section 9: doctor.status-changed must be safe to run twice, and 0-row updates
 * (doctor not registered yet) must be ignored rather than erroring.
 */
@ExtendWith(MockitoExtension.class)
class DoctorStatusChangedConsumerTest {

    @Mock
    private UserMapper userMapper;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private DoctorStatusChangedConsumer consumer;

    @Test
    void envelopeMessage_updatesActiveByDoctorId() {
        consumer = new DoctorStatusChangedConsumer(userMapper, objectMapper);
        when(userMapper.updateActiveByDoctorId(3L, false)).thenReturn(1);

        String message = "{\"eventId\":\"e1\",\"eventType\":\"doctor.status-changed\",\"occurredAt\":\"2026-10-06T10:00:00Z\",\"payload\":{\"doctorId\":3,\"active\":false}}";
        consumer.onMessage(message);

        verify(userMapper).updateActiveByDoctorId(3L, false);
    }

    @Test
    void runningTwice_isSafe_noErrorOnSecondCall() {
        consumer = new DoctorStatusChangedConsumer(userMapper, objectMapper);
        when(userMapper.updateActiveByDoctorId(3L, true)).thenReturn(1, 1);

        String message = "{\"payload\":{\"doctorId\":3,\"active\":true}}";
        consumer.onMessage(message);
        consumer.onMessage(message);

        verify(userMapper, org.mockito.Mockito.times(2)).updateActiveByDoctorId(3L, true);
    }

    @Test
    void doctorNotRegisteredYet_zeroRowsUpdated_isIgnoredNotError() {
        consumer = new DoctorStatusChangedConsumer(userMapper, objectMapper);
        when(userMapper.updateActiveByDoctorId(99L, true)).thenReturn(0);

        String message = "{\"payload\":{\"doctorId\":99,\"active\":true}}";
        // Should not throw
        consumer.onMessage(message);

        verify(userMapper).updateActiveByDoctorId(99L, true);
    }

    @Test
    void malformedMessage_doesNotThrow() {
        consumer = new DoctorStatusChangedConsumer(userMapper, objectMapper);
        consumer.onMessage("not-json");
        // no exception propagates; mapper never called with bad data
    }

    @Test
    void flatPayload_withoutEnvelope_stillWorks() {
        consumer = new DoctorStatusChangedConsumer(userMapper, objectMapper);
        when(userMapper.updateActiveByDoctorId(5L, false)).thenReturn(1);

        String message = "{\"doctorId\":5,\"active\":false}";
        consumer.onMessage(message);

        verify(userMapper).updateActiveByDoctorId(5L, false);
    }
}
