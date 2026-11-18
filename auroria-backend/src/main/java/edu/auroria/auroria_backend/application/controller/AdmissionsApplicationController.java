package edu.auroria.auroria_backend.application.controller;

import edu.auroria.auroria_backend.application.entity.Application;
import edu.auroria.auroria_backend.application.entity.ApplicationDocument;
import edu.auroria.auroria_backend.application.repository.ApplicationRepository;
import edu.auroria.auroria_backend.application.repository.ApplicationDocumentRepository;
import edu.auroria.auroria_backend.application.entity.ApplicantDetails;
import edu.auroria.auroria_backend.application.entity.AcademicRecord;

import edu.auroria.auroria_backend.application.repository.ApplicantDetailsRepository;
import edu.auroria.auroria_backend.application.repository.AcademicRecordRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ContentDisposition;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admissions")
@CrossOrigin(origins = "*")
public class AdmissionsApplicationController {

    private final ApplicationRepository applicationRepository;
    private final ApplicationDocumentRepository documentRepository;
    private final ApplicantDetailsRepository applicantDetailsRepository;
    private final AcademicRecordRepository academicRecordRepository;

    public AdmissionsApplicationController(
            ApplicationRepository applicationRepository,
            ApplicationDocumentRepository documentRepository,
            ApplicantDetailsRepository applicantDetailsRepository,
            AcademicRecordRepository academicRecordRepository) {

        this.applicationRepository = applicationRepository;
        this.documentRepository = documentRepository;
        this.applicantDetailsRepository = applicantDetailsRepository;
        this.academicRecordRepository = academicRecordRepository;
    }

    @GetMapping("/documents/{id}/file")
    @Transactional(readOnly = true)
    public ResponseEntity<Resource> viewDocument(
            @PathVariable Long id) throws Exception {

        ApplicationDocument document = documentRepository.findById(id)
                .orElse(null);

        if (document == null) {
            return ResponseEntity.notFound().build();
        }

        Path filePath = Paths.get(document.getFilePath())
                .toAbsolutePath()
                .normalize();

        if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
            return ResponseEntity.notFound().build();
        }

        Resource resource = new UrlResource(filePath.toUri());

        String mimeType = document.getMimeType();

        if (mimeType == null || mimeType.isBlank()) {
            mimeType = Files.probeContentType(filePath);
        }

        if (mimeType == null) {
            mimeType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }

        ContentDisposition disposition = ContentDisposition
                .inline()
                .filename(document.getFileName(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mimeType))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString()
                )
                .body(resource);
    }


    @PatchMapping("/documents/{id}/verify")
    @Transactional
    public ResponseEntity<?> updateDocumentStatus(
            @PathVariable Long id,
            @RequestBody UpdateDocumentStatusRequest request) {

        ApplicationDocument document = documentRepository.findById(id)
                .orElse(null);

        if (document == null) {
            return ResponseEntity.status(404).body(
                    Map.of("message", "Document not found.")
            );
        }

        if (request.status() == null || request.status().isBlank()) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", "Document status is required.")
            );
        }

        String status = request.status().trim().toUpperCase();

        if (!List.of("PENDING", "VERIFIED", "REJECTED").contains(status)) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", "Invalid document status.")
            );
        }

        document.setVerificationStatus(status);
        document.setVerificationNotes(request.notes());

        if ("PENDING".equals(status)) {
            document.setVerifiedAt(null);
        } else {
            document.setVerifiedAt(LocalDateTime.now());
        }

        documentRepository.save(document);

        return ResponseEntity.ok(
                Map.of(
                        "message", "Document status updated successfully.",
                        "documentId", document.getDocumentId(),
                        "status", document.getVerificationStatus()
                )
        );
    }

    /* =====================================================
       GET ALL APPLICATIONS
    ===================================================== */

    @GetMapping("/applications")
    @Transactional(readOnly = true)
    public ResponseEntity<List<AdmissionsApplicationResponse>> getAllApplications() {

        List<AdmissionsApplicationResponse> applications =
                applicationRepository.findAll()
                        .stream()
                        .map(application -> {

                            var applicant = application.getUser();
                            var course = application.getCourse();

                            return new AdmissionsApplicationResponse(
                                    application.getApplicationId(),
                                    application.getReferenceCode(),
                                    applicant.getUserId(),
                                    applicant.getFullName(),
                                    applicant.getEmail(),
                                    course.getCourseName(),
                                    application.getApplicationStatus(),
                                    application.getIntake(),
                                    application.getAcademicYear(),
                                    application.getSubmittedAt()
                            );
                        })
                        .toList();

        return ResponseEntity.ok(applications);
    }

    /* =====================================================
   GET ALL APPLICATION DOCUMENTS
===================================================== */


    @GetMapping("/documents")
    @Transactional(readOnly = true)
    public ResponseEntity<List<AdmissionsDocumentResponse>> getAllDocuments() {

        List<AdmissionsDocumentResponse> documents =
                documentRepository.findAll()
                        .stream()
                        .map(document -> new AdmissionsDocumentResponse(
                                document.getDocumentId(),
                                document.getApplication().getApplicationId(),
                                document.getApplication().getUser().getUserId(),
                                document.getApplication().getUser().getFullName(),
                                document.getDocumentType(),
                                document.getFileName(),
                                document.getMimeType(),
                                document.getUploadedAt(),
                                document.getVerificationStatus(),
                                document.getVerificationNotes(),
                                "/api/admissions/documents/"
                                        + document.getDocumentId() + "/file"
                        ))
                        .toList();

        return ResponseEntity.ok(documents);
    }

    /* =====================================================
   GET COMPLETE APPLICATION REVIEW DETAILS
===================================================== */

    @GetMapping("/applications/{id}/review")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getApplicationReview(
            @PathVariable Long id) {

        Application application = applicationRepository.findById(id)
                .orElse(null);

        if (application == null) {
            return ResponseEntity.status(404).body(
                    Map.of("message", "Application not found.")
            );
        }

        var user = application.getUser();
        var course = application.getCourse();

        // Personal information submitted with THIS application.
        var applicantDetails = applicantDetailsRepository
                .findByApplication_ApplicationId(id)
                .orElse(null);

        // Academic qualifications submitted with THIS application.
        List<AcademicRecordResponse> academicRecords =
                academicRecordRepository
                        .findByApplication_ApplicationId(id)
                        .stream()
                        .map(record -> new AcademicRecordResponse(
                                record.getAcademicRecordId(),
                                record.getInstitutionName(),
                                record.getQualificationName(),
                                record.getExaminationBody(),
                                record.getExaminationNumber(),
                                record.getExaminationYear(),
                                record.getSubjectName(),
                                record.getGradeObtained(),
                                record.getVerificationStatus()
                        ))
                        .toList();

        // Documents submitted with THIS application.
        List<AdmissionsDocumentResponse> documents =
                documentRepository
                        .findByApplication_ApplicationId(id)
                        .stream()
                        .map(document -> new AdmissionsDocumentResponse(
                                document.getDocumentId(),
                                document.getApplication().getApplicationId(),
                                document.getApplication().getUser().getUserId(),
                                document.getApplication().getUser().getFullName(),
                                document.getDocumentType(),
                                document.getFileName(),
                                document.getMimeType(),
                                document.getUploadedAt(),
                                document.getVerificationStatus(),
                                document.getVerificationNotes(),
                                "/api/admissions/documents/" + document.getDocumentId() + "/file"
                        ))
                        .toList();

        ApplicantDetailsResponse personalDetails = null;

        if (applicantDetails != null) {

            personalDetails = new ApplicantDetailsResponse(
                    applicantDetails.getDateOfBirth(),
                    applicantDetails.getGender(),
                    applicantDetails.getNationality(),
                    applicantDetails.getResidentialAddress(),
                    applicantDetails.getCity(),
                    applicantDetails.getStateOrRegion(),
                    applicantDetails.getCountry(),
                    applicantDetails.getEmergencyContactName(),
                    applicantDetails.getEmergencyContactPhone()
            );
        }

        AdmissionsApplicationReviewResponse response =
                new AdmissionsApplicationReviewResponse(
                        application.getApplicationId(),
                        application.getReferenceCode(),
                        user.getUserId(),
                        user.getFullName(),
                        user.getEmail(),
                        course.getCourseName(),
                        application.getApplicationStatus(),
                        application.getIntake(),
                        application.getAcademicYear(),
                        application.getSubmittedAt(),
                        personalDetails,
                        academicRecords,
                        documents
                );

        return ResponseEntity.ok(response);
    }

    /* =====================================================
       UPDATE APPLICATION STATUS
    ===================================================== */

    @PatchMapping("/applications/{id}/status")
    @Transactional
    public ResponseEntity<?> updateApplicationStatus(
            @PathVariable Long id,
            @RequestBody UpdateApplicationStatusRequest request) {

        Application application = applicationRepository.findById(id)
                .orElse(null);

        if (application == null) {
            return ResponseEntity.status(404).body(
                    Map.of("message", "Application not found.")
            );
        }

        String status = request.status();

        if (status == null || status.isBlank()) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", "Application status is required.")
            );
        }

        status = status.trim().toUpperCase();

        /* =============================================
           ALLOWED STATUSES
        ============================================= */

        if (!List.of(
                "PENDING",
                "UNDER_REVIEW",
                "APPROVED",
                "REJECTED"
        ).contains(status)) {

            return ResponseEntity.badRequest().body(
                    Map.of("message", "Invalid application status.")
            );
        }

        /* =============================================
           DOCUMENT VERIFICATION REQUIREMENT

           An application cannot be approved unless:
           1. At least one document has been submitted.
           2. Every submitted document is VERIFIED.
        ============================================= */

        if ("APPROVED".equals(status)) {

            List<ApplicationDocument> documents =
                    documentRepository.findByApplication_ApplicationId(id);

            if (documents.isEmpty()) {

                return ResponseEntity.badRequest().body(
                        Map.of(
                                "message",
                                "This application cannot be approved because the applicant has not submitted any documents."
                        )
                );
            }

            boolean allDocumentsVerified = documents.stream()
                    .allMatch(document ->
                            "VERIFIED".equalsIgnoreCase(
                                    document.getVerificationStatus()
                            )
                    );

            if (!allDocumentsVerified) {

                return ResponseEntity.badRequest().body(
                        Map.of(
                                "message",
                                "This application cannot be approved. All submitted documents must be verified first."
                        )
                );
            }
        }

        /* =============================================
           SAVE APPLICATION STATUS
        ============================================= */

        application.setApplicationStatus(status);

        applicationRepository.save(application);

        return ResponseEntity.ok(
                Map.of(
                        "message",
                        "Application status updated successfully.",
                        "applicationId",
                        application.getApplicationId(),
                        "status",
                        application.getApplicationStatus()
                )
        );
    }

    /* =====================================================
       REQUEST DTO
    ===================================================== */

    public record UpdateApplicationStatusRequest(
            String status,
            String reviewNotes
    ) {}



    /* =====================================================
       RESPONSE DTO
    ===================================================== */

    public record AdmissionsApplicationResponse(
            Long applicationId,
            String referenceCode,
            Integer userId,
            String applicantName,
            String applicantEmail,
            String courseName,
            String applicationStatus,
            String intake,
            String academicYear,
            LocalDateTime submittedAt
    ) {}

    public record AdmissionsDocumentResponse(
            Long documentId,
            Long applicationId,
            Integer userId,
            String applicantName,
            String documentType,
            String fileName,
            String mimeType,
            LocalDateTime uploadedAt,
            String verificationStatus,
            String verificationNotes,
            String fileUrl
    ) {}

    public record AdmissionsApplicationReviewResponse(

            Long applicationId,
            String referenceCode,
            Integer userId,
            String applicantName,
            String applicantEmail,
            String courseName,
            String applicationStatus,
            String intake,
            String academicYear,
            LocalDateTime submittedAt,

            ApplicantDetailsResponse applicantDetails,

            List<AcademicRecordResponse> academicRecords,

            List<AdmissionsDocumentResponse> documents

    ) {}


    public record ApplicantDetailsResponse(

            java.time.LocalDate dateOfBirth,
            String gender,
            String nationality,
            String residentialAddress,
            String city,
            String stateOrRegion,
            String country,
            String emergencyContactName,
            String emergencyContactPhone

    ) {}

    public record UpdateDocumentStatusRequest(
            String status,
            String notes
    ) {}


    public record AcademicRecordResponse(

            Long academicRecordId,
            String institutionName,
            String qualificationName,
            String examinationBody,
            String examinationNumber,
            Short examinationYear,
            String subjectName,
            String gradeObtained,
            String verificationStatus

    ) {}
}