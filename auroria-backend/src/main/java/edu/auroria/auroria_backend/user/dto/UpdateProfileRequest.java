package edu.auroria.auroria_backend.user.dto;
import java.time.LocalDate;

public record UpdateProfileRequest(
        String fullName,
        String phone,
        LocalDate dateOfBirth,
        String nationality,
        String stateOfOrigin,
        String emergencyContact,
        String address
) {}