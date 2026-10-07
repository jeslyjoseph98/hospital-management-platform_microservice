package com.hms.userservice.event;

/**
 * Kafka message envelope per SVC-00 section 8.1.
 */
public class EventEnvelope<T> {
    private String eventId;
    private String eventType;
    private String occurredAt;
    private T payload;

    public EventEnvelope() {
    }

    public EventEnvelope(String eventId, String eventType, String occurredAt, T payload) {
        this.eventId = eventId;
        this.eventType = eventType;
        this.occurredAt = occurredAt;
        this.payload = payload;
    }

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(String occurredAt) {
        this.occurredAt = occurredAt;
    }

    public T getPayload() {
        return payload;
    }

    public void setPayload(T payload) {
        this.payload = payload;
    }
}
