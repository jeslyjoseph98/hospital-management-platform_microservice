package com.hms.doctor.client;

import com.hms.doctor.exception.ServiceUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.List;

/**
 * Sync client for appointment-service's internal future-counts API.
 * MS-R4: connect timeout 2s, read timeout 5s. Any failure (down/timeout/5xx) -> 503 SERVICE_UNAVAILABLE.
 */
@Component
public class AppointmentServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AppointmentServiceClient.class);

    private final RestClient restClient;

    public AppointmentServiceClient(@Value("${hms.services.appointment-url}") String baseUrl) {
        var requestFactory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout((int) Duration.ofSeconds(2).toMillis());
        requestFactory.setReadTimeout((int) Duration.ofSeconds(5).toMillis());
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    /**
     * Returns future dates (>= today) with booking counts for the given doctor.
     * Empty list if the doctor has no future bookings.
     */
    public List<FutureCount> getFutureCounts(Long doctorId) {
        try {
            FutureCount[] result = restClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/internal/appointments/future-counts")
                            .queryParam("doctorId", doctorId)
                            .build())
                    .exchange((request, response) -> {
                        if (response.getStatusCode().is5xxServerError()) {
                            throw new ServiceUnavailableException(
                                    "appointment-service is unavailable (status " + response.getStatusCode() + ")");
                        }
                        HttpStatusCode status = response.getStatusCode();
                        if (status.is2xxSuccessful()) {
                            return response.bodyTo(FutureCount[].class);
                        }
                        throw new ServiceUnavailableException(
                                "appointment-service returned unexpected status " + status);
                    });
            return result == null ? List.of() : List.of(result);
        } catch (ServiceUnavailableException e) {
            throw e;
        } catch (RestClientException e) {
            log.warn("Call to appointment-service future-counts failed for doctorId={}: {}", doctorId, e.getMessage());
            throw new ServiceUnavailableException("appointment-service is unavailable");
        }
    }
}
