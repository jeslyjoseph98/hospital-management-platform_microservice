package com.hms.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.web.reactive.error.ErrorWebFluxAutoConfiguration;

/**
 * Excludes Spring Boot's default reactive error handling autoconfiguration;
 * {@link com.hms.gateway.exception.ErrorHandlingConfig} registers our own
 * replacement so every error is rendered as the standard JSON envelope
 * (SVC-00 section 7) instead of the default error page.
 */
@SpringBootApplication(exclude = ErrorWebFluxAutoConfiguration.class)
public class GatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
