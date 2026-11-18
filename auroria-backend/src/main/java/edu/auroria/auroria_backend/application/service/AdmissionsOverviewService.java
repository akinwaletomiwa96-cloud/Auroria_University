package edu.auroria.auroria_backend.application.service;

import edu.auroria.auroria_backend.application.dto.AdmissionsOverviewResponse;
import edu.auroria.auroria_backend.application.dto.RecentApplicationResponse;
import edu.auroria.auroria_backend.application.entity.Application;
import edu.auroria.auroria_backend.application.repository.ApplicationDocumentRepository;
import edu.auroria.auroria_backend.application.repository.ApplicationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class AdmissionsOverviewService {

    private final ApplicationRepository applicationRepository;
    private final ApplicationDocumentRepository documentRepository;

    public AdmissionsOverviewService(
            ApplicationRepository applicationRepository,
            ApplicationDocumentRepository documentRepository
    ) {
        this.applicationRepository = applicationRepository;
        this.documentRepository = documentRepository;
    }

    public AdmissionsOverviewResponse getOverview() {

        long totalApplications =
                applicationRepository.countBySubmittedAtIsNotNull();

        long pendingApplications =
                applicationRepository.countByApplicationStatus("SUBMITTED");

        long approvedApplications =
                applicationRepository.countByApplicationStatus("APPROVED");

        long rejectedApplications =
                applicationRepository.countByApplicationStatus("REJECTED");

        long pendingDocuments =
                documentRepository.countByVerificationStatus("PENDING");

        List<RecentApplicationResponse> recentApplications =
                applicationRepository
                        .findTop10BySubmittedAtIsNotNullOrderBySubmittedAtDesc()
                        .stream()
                        .map(this::toRecentApplicationResponse)
                        .toList();

        return new AdmissionsOverviewResponse(
                totalApplications,
                pendingApplications,
                approvedApplications,
                rejectedApplications,
                pendingDocuments,
                recentApplications
        );
    }

    private RecentApplicationResponse toRecentApplicationResponse(Application application) {

        String applicantName = application.getUser() != null
                ? application.getUser().getFullName()
                : "Unknown Applicant";

        String courseName = application.getCourse() != null
                ? application.getCourse().getCourseName()
                : "Unknown Course";

        return new RecentApplicationResponse(
                application.getApplicationId(),
                application.getReferenceCode(),
                applicantName,
                courseName,
                application.getIntake(),
                application.getAcademicYear(),
                application.getApplicationStatus(),
                application.getEstimatedFee(),
                application.getSubmittedAt()
        );
    }
}
