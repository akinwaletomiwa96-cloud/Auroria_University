package edu.auroria.auroria_backend.user.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record AdminOverviewResponse(
        long totalStudents,
        long totalStaff,
        long totalAdmissionsOfficers,
        long totalApplications,
        long pendingApplications,
        long approvedApplications,
        long rejectedApplications,
        long draftApplications,
        long pendingDocuments,
        long totalCourses,
        long totalDepartments,
        long newEnquiries,
        List<RecentRegistration> recentRegistrations,
        List<RecentApplication> recentApplications,
        List<ActivityItem> recentActivity
) {

    public record RecentRegistration(
            Integer userId,
            String fullName,
            String email,
            LocalDateTime createdAt
    ) {}

    public record RecentApplication(
            Long applicationId,
            String referenceCode,
            String applicantName,
            String courseName,
            String intake,
            String academicYear,
            String applicationStatus,
            BigDecimal estimatedFee,
            LocalDateTime submittedAt
    ) {}

    public record ActivityItem(
            String title,
            String description,
            String type,
            LocalDateTime date
    ) {}
}
