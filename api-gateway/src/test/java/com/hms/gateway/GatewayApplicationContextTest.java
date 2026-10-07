package com.hms.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Verifies the full Spring context (routes, CORS filter, global auth filter,
 * error handler) wires up without errors. Uses random ports so it does not
 * collide with a locally running gateway.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class GatewayApplicationContextTest {

    @Test
    void contextLoads() {
        // If the context fails to start, this test fails.
    }
}
