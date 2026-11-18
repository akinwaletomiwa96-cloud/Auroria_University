package edu.auroria.auroria_backend.application.dto;

import java.util.List;

public record AdmissionsOverviewResponse(
        long totalApplications,
        long pendingApplications,
        long approvedApplications,
        long rejectedApplications,
        long pendingDocuments,
        List<RecentApplicationResponse> recentApplications
) {
}