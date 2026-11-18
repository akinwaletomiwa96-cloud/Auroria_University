package edu.auroria.auroria_backend.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.util.List;

public record CreateApplicationRequest(

        @NotNull
        @Positive
        Integer userId,

        @NotNull
        @Positive
        Integer courseId,

        @NotBlank
        String intake,

        @NotBlank
        @Pattern(
                regexp = "\\d{4}/\\d{4}",
                message = "Academic year must look like 2027/2028."
        )
        String academicYear

) {
        public static record AdmissionsOverviewResponse(
                long totalApplications,
                long pendingApplications,
                long approvedApplications,
                long rejectedApplications,
                long pendingDocuments,
                List<MultipartApplicationRequest.RecentApplicationResponse> recentApplications
        ) {
        }
}
