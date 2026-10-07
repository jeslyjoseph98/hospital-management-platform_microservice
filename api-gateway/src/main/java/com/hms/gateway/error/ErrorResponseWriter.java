package com.hms.gateway.error;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

/**
 * Writes the standard JSON error envelope (SVC-00 section 7) onto a
 * reactive HTTP response, instead of Spring's default error page/body.
 */
public final class ErrorResponseWriter {

    private static final Logger log = LoggerFactory.getLogger(ErrorResponseWriter.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ErrorResponseWriter() {
    }

    public static Mono<Void> write(ServerHttpResponse response, HttpStatus status, String errorCode, String message) {
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        byte[] bytes;
        try {
            bytes = MAPPER.writeValueAsBytes(ApiErrorResponse.of(errorCode, message));
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize error response", e);
            bytes = ("{\"success\":false,\"errorCode\":\"" + errorCode
                    + "\",\"message\":\"Internal error\",\"fieldErrors\":[],\"data\":null}")
                    .getBytes(StandardCharsets.UTF_8);
        }
        var buffer = response.bufferFactory().wrap(bytes);
        return response.writeWith(Mono.just(buffer));
    }
}
