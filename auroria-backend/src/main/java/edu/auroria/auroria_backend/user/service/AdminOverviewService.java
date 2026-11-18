package edu.auroria.auroria_backend.user.service;


import edu.auroria.auroria_backend.user.dto.AdminOverviewResponse;
import edu.auroria.auroria_backend.application.entity.Application;
import edu.auroria.auroria_backend.application.repository.ApplicationDocumentRepository;
import edu.auroria.auroria_backend.application.repository.ApplicationRepository;
import edu.auroria.auroria_backend.course.repository.CourseRepository;
import edu.auroria.auroria_backend.course.repository.DepartmentRepository;
import edu.auroria.auroria_backend.enquiry.entity.Enquiry;
import edu.auroria.auroria_backend.enquiry.repository.EnquiryRepository;
import edu.auroria.auroria_backend.user.entity.User;
import edu.auroria.auroria_backend.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class AdminOverviewService {

    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final ApplicationDocumentRepository documentRepository;
    private final CourseRepository courseRepository;
    private final DepartmentRepository departmentRepository;
    private final EnquiryRepository enquiryRepository;

    public AdminOverviewService(
            UserRepository userRepository,
            ApplicationRepository applicationRepository,
            ApplicationDocumentRepository documentRepository,
            CourseRepository courseRepository,
            DepartmentRepository departmentRepository,
            EnquiryRepository enquiryRepository
    ) {
        this.userRepository = userRepository;
        this.applicationRepository = applicationRepository;
        this.documentRepository = documentRepository;
        this.courseRepository = courseRepository;
        this.departmentRepository = departmentRepository;
        this.enquiryRepository = enquiryRepository;
    }

    @Transactional(readOnly = true)
    public AdminOverviewResponse getOverview() {

        long students =
                userRepository.countByRole_RoleNameIgnoreCase("APPLICANT");

        long admissionsOfficers =
                userRepository.countByRole_RoleNameIgnoreCase(
                        "ADMISSIONS_OFFICER"
                );

        long administrators =
                userRepository.countByRole_RoleNameIgnoreCase("ADMIN");

        long totalStaff = admissionsOfficers + administrators;

        long totalApplications = applicationRepository.count();

        long pendingApplications =
                applicationRepository.countByApplicationStatus("SUBMITTED");

        long approvedApplications =
                applicationRepository.countByApplicationStatus("APPROVED");

        long rejectedApplications =
                applicationRepository.countByApplicationStatus("REJECTED");

        long draftApplications =
                applicationRepository.countByApplicationStatus("DRAFT");

        long pendingDocuments =
                documentRepository.countByVerificationStatus("PENDING");

        long totalCourses = courseRepository.count();

        long totalDepartments = departmentRepository.count();

        long newEnquiries =
                enquiryRepository.countByStatusIgnoreCase("NEW");

        List<AdminOverviewResponse.RecentRegistration> registrations =
                userRepository
                        .findTop5ByRole_RoleNameIgnoreCaseOrderByCreatedAtDesc(
                                "APPLICANT"
                        )
                        .stream()
                        .map(this::mapRegistration)
                        .toList();

        List<AdminOverviewResponse.RecentApplication> applications =
                applicationRepository
                        .findTop10BySubmittedAtIsNotNullOrderBySubmittedAtDesc()
                        .stream()
                        .map(this::mapApplication)
                        .toList();

        List<AdminOverviewResponse.ActivityItem> activities =
                buildRecentActivity(registrations, applications);

        return new AdminOverviewResponse(
                students,
                totalStaff,
                admissionsOfficers,
                totalApplications,
                pendingApplications,
                approvedApplications,
                rejectedApplications,
                draftApplications,
                pendingDocuments,
                totalCourses,
                totalDepartments,
                newEnquiries,
                registrations,
                applications,
                activities
        );
    }

    private AdminOverviewResponse.RecentRegistration mapRegistration(
            User user
    ) {
        return new AdminOverviewResponse.RecentRegistration(
                user.getUserId(),
                user.getFullName(),
                user.getEmail(),
                user.getCreatedAt()
        );
    }

    private AdminOverviewResponse.RecentApplication mapApplication(
            Application application
    ) {
        return new AdminOverviewResponse.RecentApplication(
                application.getApplicationId(),
                application.getReferenceCode(),
                application.getUser().getFullName(),
                application.getCourse().getCourseName(),
                application.getIntake(),
                application.getAcademicYear(),
                application.getApplicationStatus(),
                application.getEstimatedFee(),
                application.getSubmittedAt()
        );
    }

    private List<AdminOverviewResponse.ActivityItem> buildRecentActivity(
            List<AdminOverviewResponse.RecentRegistration> registrations,
            List<AdminOverviewResponse.RecentApplication> applications
    ) {
        List<AdminOverviewResponse.ActivityItem> activities =
                new ArrayList<>();

        for (var registration : registrations) {
            activities.add(
                    new AdminOverviewResponse.ActivityItem(
                            "New student registration",
                            registration.fullName() + " registered an account",
                            "REGISTRATION",
                            registration.createdAt()
                    )
            );
        }

        for (var application : applications) {
            activities.add(
                    new AdminOverviewResponse.ActivityItem(
                            "Application submitted",
                            application.applicantName()
                                    + " submitted "
                                    + application.referenceCode(),
                            "APPLICATION",
                            application.submittedAt()
                    )
            );
        }

        return activities.stream()
                .filter(activity -> activity.date() != null)
                .sorted(
                        Comparator.comparing(
                                AdminOverviewResponse.ActivityItem::date
                        ).reversed()
                )
                .limit(10)
                .toList();
    }
}
