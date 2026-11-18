package edu.auroria.auroria_backend.application.service;

import edu.auroria.auroria_backend.application.entity.Application;
import edu.auroria.auroria_backend.application.repository.ApplicationRepository;
import edu.auroria.auroria_backend.course.entity.Course;
import edu.auroria.auroria_backend.course.repository.CourseRepository;
import edu.auroria.auroria_backend.user.entity.User;
import edu.auroria.auroria_backend.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import edu.auroria.auroria_backend.application.dto.ApplicantDetailsRequest;
import edu.auroria.auroria_backend.application.dto.AcademicRecordRequest;
import edu.auroria.auroria_backend.application.entity.ApplicantDetails;
import edu.auroria.auroria_backend.application.entity.AcademicRecord;
import edu.auroria.auroria_backend.application.repository.ApplicantDetailsRepository;
import edu.auroria.auroria_backend.application.repository.AcademicRecordRepository;
import java.util.List;
import edu.auroria.auroria_backend.application.dto.MultipartApplicationRequest;
import edu.auroria.auroria_backend.application.entity.ApplicationDocument;
import edu.auroria.auroria_backend.application.repository.ApplicationDocumentRepository;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Set;
import java.util.Map;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final ApplicantDetailsRepository applicantDetailsRepository;
    private final AcademicRecordRepository academicRecordRepository;
    private final ApplicationDocumentRepository applicationDocumentRepository;

    public ApplicationService(
            ApplicationRepository applicationRepository,
            CourseRepository courseRepository,
            UserRepository userRepository,
            ApplicantDetailsRepository applicantDetailsRepository,
            ApplicationDocumentRepository applicationDocumentRepository,
            AcademicRecordRepository academicRecordRepository) {

        this.applicationRepository = applicationRepository;
        this.courseRepository = courseRepository;
        this.userRepository = userRepository;
        this.applicantDetailsRepository = applicantDetailsRepository;
        this.academicRecordRepository = academicRecordRepository;
        this.applicationDocumentRepository = applicationDocumentRepository;
    }
    @Transactional
    public Application createApplication(
            Integer userId,
            Integer courseId,
            String intake,
            String academicYear) {

        if (intake == null || intake.isBlank()) {
            throw new IllegalArgumentException("Intake is required.");
        }

        if (academicYear == null || !academicYear.matches("\\d{4}/\\d{4}")) {
            throw new IllegalArgumentException(
                    "Academic year must use the format 2027/2028.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new IllegalArgumentException("User not found."));

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Course not found."));

        if (!Boolean.TRUE.equals(course.getAvailable())) {
            throw new IllegalArgumentException(
                    "This course is not currently available.");
        }
        validateApplicationLimit(userId, courseId);

        Application application = new Application();
        application.setUser(user);
        application.setCourse(course);
        application.setIntake(intake.trim());
        application.setAcademicYear(academicYear);
        application.setApplicationStatus("SUBMITTED");
        application.setEstimatedFee(course.getEstimatedFee());
        application.setSubmittedAt(LocalDateTime.now());
        application.setReferenceCode(generateReferenceCode());

        return applicationRepository.save(application);
    }
    private void validateApplicationLimit(Integer userId, Integer courseId) {

        // Check whether the student has already submitted an application
        // for this course. Drafts are excluded.
        boolean alreadyApplied = applicationRepository
                .existsByUser_UserIdAndCourse_CourseIdAndApplicationStatusNot(
                        userId,
                        courseId,
                        "DRAFT"
                );

        if (alreadyApplied) {
            throw new IllegalArgumentException(
                    "You have already applied for this course. You cannot apply for the same course twice."
            );
        }

        // Count submitted applications, excluding drafts.
        long applicationCount = applicationRepository
                .countByUser_UserIdAndApplicationStatusNot(
                        userId,
                        "DRAFT"
                );

        if (applicationCount >= 3) {
            throw new IllegalArgumentException(
                    "You can only apply for a maximum of three different courses."
            );
        }
    }

    private String generateReferenceCode() {
        String referenceCode;

        do {
            referenceCode = "AUR-" +
                    UUID.randomUUID()
                            .toString()
                            .substring(0, 8)
                            .toUpperCase();
        } while (applicationRepository
                .existsByReferenceCode(referenceCode));

        return referenceCode;
    }


    public ApplicantDetails getApplicantDetails(Long applicationId) {

        return applicantDetailsRepository
                .findByApplication_ApplicationId(applicationId)
                .orElseThrow(() ->
                        new RuntimeException("Applicant details not found.")
                );
    }
    @Transactional
    public ApplicantDetails saveApplicantDetails(
            Long applicationId,
            ApplicantDetailsRequest request) {

        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Application not found."));

        ApplicantDetails details = applicantDetailsRepository
                .findByApplication_ApplicationId(applicationId)
                .orElseGet(ApplicantDetails::new);

        details.setApplication(application);
        details.setDateOfBirth(request.dateOfBirth());
        details.setGender(request.gender());
        details.setNationality(request.nationality());
        details.setResidentialAddress(request.residentialAddress());
        details.setCity(request.city());
        details.setStateOrRegion(request.stateOrRegion());
        details.setCountry(request.country());
        details.setEmergencyContactName(request.emergencyContactName());
        details.setEmergencyContactPhone(request.emergencyContactPhone());

        return applicantDetailsRepository.save(details);
    }

    @Transactional
    public AcademicRecord saveAcademicRecord(
            Long applicationId,
            AcademicRecordRequest request) {

        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Application not found."));

        AcademicRecord record = new AcademicRecord();
        record.setApplication(application);
        record.setInstitutionName(request.institutionName());
        record.setQualificationName(request.qualificationName());
        record.setExaminationBody(request.examinationBody());
        record.setExaminationNumber(request.examinationNumber());
        record.setExaminationYear(request.examinationYear());
        record.setSubjectName(request.subjectName());
        record.setGradeObtained(request.gradeObtained());

        // New academic records await admissions verification.
        record.setVerificationStatus("PENDING");

        return academicRecordRepository.save(record);
    }

    @Transactional(readOnly = true)
    public List<AcademicRecord> getAcademicRecords(Long applicationId) {
        if (!applicationRepository.existsById(applicationId)) {
            throw new IllegalArgumentException("Application not found.");
        }

        return academicRecordRepository
                .findByApplication_ApplicationId(applicationId);
    }

    @Transactional
    public Application saveDraft(
            Integer userId,
            Integer courseId,
            String intake,
            String academicYear) {

        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new IllegalArgumentException("User not found."));

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Course not found."));

        if (!Boolean.TRUE.equals(course.getAvailable())) {
            throw new IllegalArgumentException(
                    "This course is not currently available.");
        }
        boolean alreadyApplied = applicationRepository
                .existsByUser_UserIdAndCourse_CourseIdAndApplicationStatusNot(
                        userId,
                        courseId,
                        "DRAFT"
                );

        if (alreadyApplied) {
            throw new IllegalArgumentException(
                    "You have already applied for this course."
            );
        }

        if (intake == null || intake.isBlank()) {
            throw new IllegalArgumentException("Intake is required.");
        }

        if (academicYear == null
                || !academicYear.matches("\\d{4}/\\d{4}")) {
            throw new IllegalArgumentException(
                    "Academic year must use the format 2027/2028.");
        }

        Application application = applicationRepository
                .findFirstByUser_UserIdAndApplicationStatusOrderByApplicationIdDesc(
                        userId, "DRAFT")
                .orElseGet(Application::new);

        application.setUser(user);
        application.setCourse(course);
        application.setIntake(intake.trim());
        application.setAcademicYear(academicYear);
        application.setApplicationStatus("DRAFT");
        application.setEstimatedFee(course.getEstimatedFee());

        if (application.getReferenceCode() == null) {
            application.setReferenceCode(generateReferenceCode());
        }

        return applicationRepository.save(application);
    }

    @Transactional
    public Application submitWithDocuments(
            MultipartApplicationRequest request,
            List<MultipartFile> resultFiles) throws IOException {

        if (request.applicantDetails() == null) {
            throw new IllegalArgumentException(
                    "Applicant details are required.");
        }

        if (request.academicQualifications() == null
                || request.academicQualifications().isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one academic qualification is required.");
        }

        Application application = createApplication(
                request.userId(),
                request.courseId(),
                request.intake(),
                request.academicYear()
        );

        var applicant = request.applicantDetails();

        saveApplicantDetails(
                application.getApplicationId(),
                new ApplicantDetailsRequest(
                        applicant.dateOfBirth(),
                        applicant.gender(),
                        applicant.nationality(),
                        applicant.residentialAddress(),
                        applicant.city(),
                        applicant.stateOrRegion(),
                        applicant.country(),
                        applicant.emergencyContactName(),
                        applicant.emergencyContactPhone()
                )
        );

        List<MultipartFile> files =
                resultFiles == null ? List.of() : resultFiles;

        List<Path> savedFiles = new ArrayList<>();

        try {
            Path uploadDirectory = Paths.get(
                    "uploads", "applications",
                    application.getApplicationId().toString()
            ).toAbsolutePath().normalize();

            Files.createDirectories(uploadDirectory);

            int fileIndex = 0;

            for (var qualification : request.academicQualifications()) {
                Short year = qualification.examinationYear() == null
                        ? null
                        : qualification.examinationYear().shortValue();

                saveAcademicRecord(
                        application.getApplicationId(),
                        new AcademicRecordRequest(
                                qualification.institutionName(),
                                qualification.qualificationName(),
                                qualification.examinationBody(),
                                qualification.examinationNumber(),
                                year,
                                null,
                                null,
                                null
                        )
                );

                if (fileIndex < files.size()) {
                    MultipartFile file = files.get(fileIndex++);

                    if (file != null && !file.isEmpty()) {
                        if (file.getSize() > 8L * 1024 * 1024) {
                            throw new IllegalArgumentException(
                                    "Each result file must be 8 MB or smaller.");
                        }

                        String contentType = file.getContentType();

                        if (contentType == null
                                || !Set.of(
                                "application/pdf",
                                "image/jpeg",
                                "image/png"
                        ).contains(contentType)) {
                            throw new IllegalArgumentException(
                                    "Only PDF, JPEG, and PNG result files are allowed.");
                        }

                        String originalName = Paths.get(
                                file.getOriginalFilename() == null
                                        ? "result"
                                        : file.getOriginalFilename()
                        ).getFileName().toString();

                        String storedName = UUID.randomUUID()
                                + getSafeExtension(originalName);

                        Path destination = uploadDirectory
                                .resolve(storedName)
                                .normalize();

                        if (!destination.startsWith(uploadDirectory)) {
                            throw new IllegalArgumentException(
                                    "Invalid upload filename.");
                        }

                        Files.copy(
                                file.getInputStream(),
                                destination,
                                StandardCopyOption.REPLACE_EXISTING
                        );

                        savedFiles.add(destination);

                        ApplicationDocument document =
                                new ApplicationDocument();

                        document.setApplication(application);
                        document.setDocumentType("ACADEMIC_RESULT");
                        document.setFileName(originalName);
                        document.setFilePath(
                                "uploads/applications/"
                                        + application.getApplicationId()
                                        + "/" + storedName
                        );
                        document.setMimeType(contentType);
                        document.setVerificationStatus("PENDING");

                        applicationDocumentRepository.save(document);
                    }
                }
            }

            if (fileIndex < files.size()) {
                for (int i = fileIndex; i < files.size(); i++) {
                    MultipartFile extra = files.get(i);
                    if (extra != null && !extra.isEmpty()) {
                        throw new IllegalArgumentException(
                                "There are more result files than qualifications.");
                    }
                }
            }

            return application;

        } catch (IOException | RuntimeException exception) {
            for (Path savedFile : savedFiles) {
                try {
                    Files.deleteIfExists(savedFile);
                } catch (IOException cleanupError) {
                    exception.addSuppressed(cleanupError);
                }
            }

            throw exception;
        }
    }

    private String getSafeExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0) {
            return "";
        }

        String extension = filename.substring(dot).toLowerCase();

        return Set.of(".pdf", ".jpg", ".jpeg", ".png")
                .contains(extension) ? extension : "";
    }



}
