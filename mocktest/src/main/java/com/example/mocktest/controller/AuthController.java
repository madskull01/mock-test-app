package com.example.mocktest.controller;

import com.example.mocktest.dto.auth.LoginRequest;
import com.example.mocktest.dto.auth.LoginResponse;
import com.example.mocktest.dto.user.CreateUserRequest;
import com.example.mocktest.dto.user.UserResponse;
import com.example.mocktest.security.JwtService;
import com.example.mocktest.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
        private final JwtService jwtService;

    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(
            @Valid @RequestBody CreateUserRequest request) {

        UserResponse response =
                userService.createUser(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request) {

        LoginResponse response = userService.authenticate(request);
        response.setToken(jwtService.generateToken(
                response.getUserId(),
                response.getEmail(),
                response.getRole()
        ));

        return ResponseEntity.ok(response);
    }
}
