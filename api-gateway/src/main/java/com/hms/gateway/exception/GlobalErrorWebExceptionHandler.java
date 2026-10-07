package com.hms.gateway.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.web.WebProperties;
import org.springframework.boot.autoconfigure.web.reactive.error.AbstractErrorWebExceptionHandler;
import org.springframework.boot.web.reactive.error.ErrorAttributes;
import org.springframework.cloud.gateway.support.NotFoundException;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.codec.ServerCodecConfigurer;
import org.springframework.web.reactive.function.server.RequestPredicates;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import org.springframework.web.reactive.resource.NoResourceFoundException;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.net.ConnectException;
import java.util.concurrent.TimeoutException;

/**
 * Replaces Spring Boot/Gateway's default error page with the standard JSON
 * error envelope (SVC-00 section 7) for any exception that escapes the
 * routing filters — chiefly downstream connectivity failures (GW-R6):
 * connection refused, no response within the configured timeout, or any
 * other I/O failure while proxying -> 503 {@code SERVICE_UNAVAILABLE}.
 */
public class GlobalErrorWebExceptionHandler extends AbstractErrorWebExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalErrorWebExceptionHandler.class);

    public GlobalErrorWebExceptionHandler(ErrorAttributes errorAttributes,
                                           WebProperties webProperties,
                                           ApplicationContext applicationContext,
                                           ServerCodecConfigurer serverCodecConfigurer) {
        super(errorAttributes, webProperties.getResources(), applicationContext);
        super.setMessageWriters(serverCodecConfigurer.getWriters());
        super.setMessageReaders(serverCodecConfigurer.getReaders());
    }

    @Override
    protected RouterFunction<ServerResponse> getRoutingFunction(ErrorAttributes errorAttributes) {
        return RouterFunctions.route(RequestPredicates.all(), this::renderErrorResponse);
    }

    private Mono<ServerResponse> renderErrorResponse(ServerRequest request) {
        Throwable error = getError(request);

        HttpStatus status;
        String errorCode;
        String message;

        if (isUnavailable(error)) {
            status = HttpStatus.SERVICE_UNAVAILABLE;
            errorCode = "SERVICE_UNAVAILABLE";
            message = "A downstream service is unavailable";
        } else if (error instanceof NotFoundException || error instanceof NoResourceFoundException) {
            // GW-R7: path matched no gateway route (Spring Cloud Gateway
            // throws NotFoundException when no Route predicate matches;
            // WebFlux's own dispatcher throws NoResourceFoundException when
            // the request never reaches the gateway handler at all, e.g.
            // for paths with no route and no static resource, such as
            // /internal/**, which the gateway never exposes).
            status = HttpStatus.NOT_FOUND;
            errorCode = "NOT_FOUND";
            message = "No such route";
        } else if (error instanceof ResponseStatusException rse) {
            status = HttpStatus.valueOf(rse.getStatusCode().value());
            errorCode = status == HttpStatus.NOT_FOUND ? "NOT_FOUND" : "INTERNAL_ERROR";
            message = status == HttpStatus.NOT_FOUND ? "No such route" : "Unexpected error";
        } else {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            errorCode = "INTERNAL_ERROR";
            message = "Unexpected error";
            log.error("Unhandled gateway error", error);
        }

        return ServerResponse.status(status)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .bodyValue(com.hms.gateway.error.ApiErrorResponse.of(errorCode, message));
    }

    private boolean isUnavailable(Throwable error) {
        Throwable cause = error;
        int depth = 0;
        while (cause != null && depth < 10) {
            if (cause instanceof ConnectException
                    || cause instanceof TimeoutException
                    || cause instanceof io.netty.channel.ConnectTimeoutException
                    || cause instanceof io.netty.handler.timeout.ReadTimeoutException
                    || cause instanceof reactor.netty.http.client.PrematureCloseException
                    || (cause instanceof IOException && cause.getMessage() != null
                        && cause.getMessage().toLowerCase().contains("connection"))) {
                return true;
            }
            cause = cause.getCause();
            depth++;
        }
        return false;
    }
}
