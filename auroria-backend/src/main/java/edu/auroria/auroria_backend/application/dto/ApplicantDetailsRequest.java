package edu.auroria.auroria_backend.application.dto;

import java.time.LocalDate;

public record ApplicantDetailsRequest(
        LocalDate dateOfBirth,
        String gender,
        String nationality,
        String residentialAddress,
        String city,
        String stateOrRegion,
        String country,
        String emergencyContactName,
        String emergencyContactPhone
) {}
