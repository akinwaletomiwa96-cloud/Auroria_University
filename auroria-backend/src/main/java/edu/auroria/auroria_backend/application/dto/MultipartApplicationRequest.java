package edu.auroria.auroria_backend.application.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record MultipartApplicationRequest(

        Integer userId,
        Integer courseId,
        String intake,
        String academicYear,

        ApplicantDetailsData applicantDetails,

        List<AcademicQualificationData> academicQualifications

) {

    public record ApplicantDetailsData(
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

    public record AcademicQualificationData(
            String institutionName,
            String qualificationName,
            String examinationBody,
            String examinationNumber,
            Integer examinationYear,
            String subjectName,
            String gradeObtained
    ) {}

    public static record RecentApplicationResponse(
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
}