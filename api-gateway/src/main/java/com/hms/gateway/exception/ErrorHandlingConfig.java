package com.hms.gateway.exception;

import org.springframework.boot.autoconfigure.web.WebProperties;
import org.springframework.boot.web.reactive.error.DefaultErrorAttributes;
import org.springframework.boot.web.reactive.error.ErrorAttributes;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.codec.ServerCodecConfigurer;
import org.springframework.web.server.WebExceptionHandler;

/**
 * Registers {@link GlobalErrorWebExceptionHandler} in place of Spring Boot's
 * default (excluded via {@code @SpringBootApplication(exclude = ...)} on
 * {@link com.hms.gateway.GatewayApplication}), so every error (including
 * downstream connectivity failures, GW-R6) is rendered as the standard JSON
 * envelope instead of the default error page.
 */
@Configuration
public class ErrorHandlingConfig {

    @Bean
    public ErrorAttributes errorAttributes() {
        return new DefaultErrorAttributes();
    }

    @Bean
    @Order(-2)
    public WebExceptionHandler errorWebExceptionHandler(ErrorAttributes errorAttributes,
                                                          WebProperties webProperties,
                                                          ApplicationContext applicationContext,
                                                          ServerCodecConfigurer serverCodecConfigurer) {
        GlobalErrorWebExceptionHandler handler = new GlobalErrorWebExceptionHandler(
                errorAttributes, webProperties, applicationContext, serverCodecConfigurer);
        return handler;
    }
}
