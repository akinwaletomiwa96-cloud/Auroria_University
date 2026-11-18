package edu.auroria.auroria_backend.user.controller;

import edu.auroria.auroria_backend.user.dto.RegisterRequest;
import edu.auroria.auroria_backend.user.entity.User;
import edu.auroria.auroria_backend.user.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = {
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:5501",
        "http://127.0.0.1:5501",
        "http://localhost:63342",
        "http://127.0.0.1:63342"
})
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody Map<String, String> request) {

        try {
            User user = authService.login(
                    request.get("email"),
                    request.get("password")
            );

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Login successful.",
                    "userId", user.getUserId(),
                    "fullName", user.getFullName(),
                    "email", user.getEmail(),
                    "roleName", user.getRole().getRoleName()
            ));

        } catch (IllegalArgumentException exception) {
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "success", false,
                            "message", "Invalid email or password."
                    ));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(
            @RequestBody RegisterRequest request) {

        try {
            User user = authService.register(request);

            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(Map.of(
                            "success", true,
                            "message", "Your account has been created successfully.",
                            "userId", user.getUserId(),
                            "fullName", user.getFullName(),
                            "email", user.getEmail(),
                            "roleName", user.getRole().getRoleName()
                    ));

        } catch (IllegalArgumentException exception) {
            return ResponseEntity
                    .badRequest()
                    .body(Map.of(
                            "success", false,
                            "message", exception.getMessage()
                    ));

        } catch (IllegalStateException exception) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "success", false,
                            "message", exception.getMessage()
                    ));
        }
    }
}
