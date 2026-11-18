package edu.auroria.auroria_backend.application.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ApplicationResponse(
        Long applicationId,
        String referenceCode,
        Integer userId,
        Integer courseId,
        String courseName,
        String intake,
        String academicYear,
        String applicationStatus,
        BigDecimal estimatedFee,
        LocalDateTime submittedAt
) {}
