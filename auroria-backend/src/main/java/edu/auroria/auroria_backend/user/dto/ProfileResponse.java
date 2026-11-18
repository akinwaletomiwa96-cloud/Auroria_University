package edu.auroria.auroria_backend.user.dto;

import java.time.LocalDate;

public record ProfileResponse(
        Integer userId,
        String fullName,
        String email,
        String phone,
        LocalDate dateOfBirth,
        String nationality,
        String stateOfOrigin,
        String emergencyContact,
        String address
) {}