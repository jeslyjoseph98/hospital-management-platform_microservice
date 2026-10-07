package com.hms.userservice.controller;

import com.hms.userservice.dto.ApiResponse;
import com.hms.userservice.dto.LoginRequest;
import com.hms.userservice.dto.LoginResponse;
import com.hms.userservice.dto.RegisterRequest;
import com.hms.userservice.dto.RegisterResponse;
import com.hms.userservice.dto.UserSummary;
import com.hms.userservice.service.AuthService;
import com.hms.userservice.service.RegistrationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final RegistrationService registrationService;
    private final AuthService authService;

    public AuthController(RegistrationService registrationService, AuthService authService) {
        this.registrationService = registrationService;
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<RegisterResponse>> register(@RequestBody RegisterRequest request) {
        RegisterResponse response = registrationService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(response, "Registration successful. Please log in."));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok(response, "Login successful"));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserSummary>> me(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        UserSummary summary = authService.me(authHeader);
        return ResponseEntity.ok(ApiResponse.ok(summary, null));
    }
}
