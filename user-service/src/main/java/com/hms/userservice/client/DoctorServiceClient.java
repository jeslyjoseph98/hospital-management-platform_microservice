package com.hms.userservice.client;

import com.hms.userservice.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Sync call to doctor-service for REG-R11.
 * MS-R4: connect timeout 2s, read timeout 5s (configured on the injected RestClient);
 * down/timeout/5xx -> 503 SERVICE_UNAVAILABLE.
 */
@Component
public class DoctorServiceClient {

    private static final Logger log = LoggerFactory.getLogger(DoctorServiceClient.class);

    private final RestClient doctorServiceRestClient;

    public DoctorServiceClient(RestClient doctorServiceRestClient) {
        this.doctorServiceRestClient = doctorServiceRestClient;
    }

    public DoctorVerificationResult verifyRegistration(String registrationNumber, String phone) {
        try {
            DoctorVerifyResponse body = doctorServiceRestClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/internal/doctors/verify-registration")
                            .queryParam("registrationNumber", registrationNumber)
                            .queryParam("phone", phone)
                            .build())
                    .retrieve()
                    .body(DoctorVerifyResponse.class);
            if (body == null || body.getDoctorId() == null) {
                return DoctorVerificationResult.of(DoctorVerificationResult.Status.NOT_FOUND);
            }
            return DoctorVerificationResult.found(body.getDoctorId(), body.getFullName());
        } catch (HttpClientErrorException.NotFound e) {
            return DoctorVerificationResult.of(DoctorVerificationResult.Status.NOT_FOUND);
        } catch (HttpClientErrorException.Conflict e) {
            String reason = extractReason(e);
            if ("PHONE_MISMATCH".equals(reason)) {
                return DoctorVerificationResult.of(DoctorVerificationResult.Status.PHONE_MISMATCH);
            }
            if ("INACTIVE".equals(reason)) {
                return DoctorVerificationResult.of(DoctorVerificationResult.Status.INACTIVE);
            }
            log.warn("Unexpected 409 reason from doctor-service verify-registration: {}", reason);
            throw serviceUnavailable(e);
        } catch (HttpClientErrorException e) {
            log.warn("Unexpected 4xx from doctor-service verify-registration: {}", e.getStatusCode());
            throw serviceUnavailable(e);
        } catch (ResourceAccessException e) {
            log.warn("doctor-service unreachable/timeout during verify-registration", e);
            throw serviceUnavailable(e);
        } catch (RestClientException e) {
            log.warn("doctor-service call failed (5xx or other) during verify-registration", e);
            throw serviceUnavailable(e);
        }
    }

    private String extractReason(HttpClientErrorException.Conflict e) {
        try {
            DoctorConflictResponse conflict = e.getResponseBodyAs(DoctorConflictResponse.class);
            return conflict == null ? null : conflict.getReason();
        } catch (Exception parseEx) {
            return null;
        }
    }

    private BusinessException serviceUnavailable(Exception cause) {
        return new BusinessException("SERVICE_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE,
                "doctor-service is unavailable, please try again later");
    }
}
