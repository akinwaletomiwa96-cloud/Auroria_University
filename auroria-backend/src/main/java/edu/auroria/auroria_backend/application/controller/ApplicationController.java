
package edu.auroria.auroria_backend.application.controller;

import edu.auroria.auroria_backend.application.dto.ApplicationResponse;
import edu.auroria.auroria_backend.application.dto.CreateApplicationRequest;
import edu.auroria.auroria_backend.application.dto.ApplicantDetailsRequest;
import edu.auroria.auroria_backend.application.dto.AcademicRecordRequest;
import edu.auroria.auroria_backend.application.dto.MultipartApplicationRequest;

import edu.auroria.auroria_backend.application.entity.Application;
import edu.auroria.auroria_backend.application.entity.ApplicantDetails;
import edu.auroria.auroria_backend.application.entity.AcademicRecord;
import java.util.Optional;
import edu.auroria.auroria_backend.application.repository.ApplicationRepository;
import edu.auroria.auroria_backend.application.service.ApplicationService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    private final ApplicationService applicationService;
    private final ApplicationRepository applicationRepository;

    public ApplicationController(
            ApplicationService applicationService,
            ApplicationRepository applicationRepository) {

        this.applicationService = applicationService;
        this.applicationRepository = applicationRepository;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApplicationResponse createApplication(
            @Valid @RequestBody CreateApplicationRequest request) {

        Application application = applicationService.createApplication(
                request.userId(),
                request.courseId(),
                request.intake(),
                request.academicYear()
        );

        return toResponse(application);
    }

    @GetMapping("/reference/{referenceCode}")
    public ApplicationResponse getByReferenceCode(
            @PathVariable String referenceCode) {

        Application application = applicationRepository
                .findByReferenceCode(referenceCode)
                .orElseThrow(() ->
                        new ApplicationNotFoundException(
                                "Application not found."
                        ));

        return toResponse(application);
    }

    @PostMapping(
            value = "/with-documents",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @ResponseStatus(HttpStatus.CREATED)
    public ApplicationResponse submitWithDocuments(
            @RequestPart("application")
            MultipartApplicationRequest request,

            @RequestPart(value = "resultFiles", required = false)
            List<MultipartFile> resultFiles
    ) throws IOException {

        Application application =
                applicationService.submitWithDocuments(
                        request,
                        resultFiles
                );

        return toResponse(application);
    }

    @GetMapping("/user/{userId}")
    public List<ApplicationResponse> getByUser(
            @PathVariable Integer userId) {

        return applicationRepository.findByUser_UserId(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @GetMapping("/user/{userId}/draft")
    public ApplicationResponse getDraft(
            @PathVariable Integer userId) {

        Application application = applicationRepository
                .findFirstByUser_UserIdAndApplicationStatusOrderByApplicationIdDesc(
                        userId,
                        "DRAFT"
                )
                .orElseThrow(() ->
                        new ApplicationNotFoundException(
                                "No saved draft was found."
                        ));

        return toResponse(application);
    }

    @PostMapping("/draft")
    public ApplicationResponse saveDraft(
            @Valid @RequestBody CreateApplicationRequest request) {

        Application application = applicationService.saveDraft(
                request.userId(),
                request.courseId(),
                request.intake(),
                request.academicYear()
        );

        return toResponse(application);
    }

    @PostMapping("/{applicationId}/applicant-details")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> saveApplicantDetails(
            @PathVariable Long applicationId,
            @RequestBody ApplicantDetailsRequest request) {

        ApplicantDetails saved =
                applicationService.saveApplicantDetails(
                        applicationId,
                        request
                );

        return Map.of(
                "message", "Applicant details saved successfully.",
                "applicantDetailId", saved.getApplicantDetailId(),
                "applicationId", applicationId
        );
    }

    @GetMapping("/{applicationId}/applicant-details")
    public ApplicantDetails getApplicantDetails(
            @PathVariable Long applicationId) {

        return applicationService.getApplicantDetails(applicationId);
    }

    @PostMapping("/{applicationId}/academic-records")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> saveAcademicRecord(
            @PathVariable Long applicationId,
            @RequestBody AcademicRecordRequest request) {

        AcademicRecord saved =
                applicationService.saveAcademicRecord(
                        applicationId,
                        request
                );

        return Map.of(
                "message", "Academic record saved successfully.",
                "academicRecordId", saved.getAcademicRecordId(),
                "applicationId", applicationId,
                "verificationStatus", saved.getVerificationStatus()
        );
    }

    @GetMapping("/{applicationId}/academic-records")
    public List<AcademicRecordResponse> getAcademicRecords(
            @PathVariable Long applicationId) {

        return applicationService.getAcademicRecords(applicationId)
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
    }

    private ApplicationResponse toResponse(Application application) {

        return new ApplicationResponse(
                application.getApplicationId(),
                application.getReferenceCode(),
                application.getUser().getUserId(),
                application.getCourse().getCourseId(),
                application.getCourse().getCourseName(),
                application.getIntake(),
                application.getAcademicYear(),
                application.getApplicationStatus(),
                application.getEstimatedFee(),
                application.getSubmittedAt()
        );
    }

    @ResponseStatus(HttpStatus.NOT_FOUND)
    private static class ApplicationNotFoundException
            extends RuntimeException {

        public ApplicationNotFoundException(String message) {
            super(message);
        }
    }

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