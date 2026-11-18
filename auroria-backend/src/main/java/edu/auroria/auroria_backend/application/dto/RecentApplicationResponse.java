package edu.auroria.auroria_backend.application.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record RecentApplicationResponse(
        Long applicationId,
        String referenceCode,
        String applicantName,
        String courseName,
        String intake,
        String academicYear,
        String applicationStatus,
        BigDecimal estimatedFee,
        LocalDateTime submittedAt
) {
}