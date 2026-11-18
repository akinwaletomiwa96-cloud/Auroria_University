package edu.auroria.auroria_backend.application.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "academic_records")
public class AcademicRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "academic_record_id")
    private Long academicRecordId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @Column(name = "institution_name", length = 200)
    private String institutionName;

    @Column(name = "qualification_name", length = 100)
    private String qualificationName;

    @Column(name = "examination_body", length = 100)
    private String examinationBody;

    @Column(name = "examination_number", length = 50)
    private String examinationNumber;

    @Column(name = "examination_year")
    private Short examinationYear;

    @Column(name = "subject_name", length = 150, nullable = true)
    private String subjectName;

    @Column(name = "grade_obtained", length = 20, nullable = true)
    private String gradeObtained;

    @Column(
            name = "verification_status",
            nullable = false,
            length = 30
    )
    private String verificationStatus = "PENDING";

    @Column(name = "verified_by")
    private Integer verifiedBy;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "verification_notes")
    private String verificationNotes;

    @Column(name = "result_document_path", length = 500)
    private String resultDocumentPath;

    public AcademicRecord() {}

    public Long getAcademicRecordId() {
        return academicRecordId;
    }

    public Application getApplication() {
        return application;
    }

    public void setApplication(Application application) {
        this.application = application;
    }

    public String getInstitutionName() {
        return institutionName;
    }

    public void setInstitutionName(String institutionName) {
        this.institutionName = institutionName;
    }

    public String getQualificationName() {
        return qualificationName;
    }

    public void setQualificationName(String qualificationName) {
        this.qualificationName = qualificationName;
    }

    public String getExaminationBody() {
        return examinationBody;
    }

    public void setExaminationBody(String examinationBody) {
        this.examinationBody = examinationBody;
    }

    public String getExaminationNumber() {
        return examinationNumber;
    }

    public void setExaminationNumber(String examinationNumber) {
        this.examinationNumber = examinationNumber;
    }

    public Short getExaminationYear() {
        return examinationYear;
    }

    public void setExaminationYear(Short examinationYear) {
        this.examinationYear = examinationYear;
    }

    public String getSubjectName() {
        return subjectName;
    }

    public void setSubjectName(String subjectName) {
        this.subjectName = subjectName;
    }

    public String getGradeObtained() {
        return gradeObtained;
    }

    public void setGradeObtained(String gradeObtained) {
        this.gradeObtained = gradeObtained;
    }

    public String getVerificationStatus() {
        return verificationStatus;
    }

    public void setVerificationStatus(String verificationStatus) {
        this.verificationStatus = verificationStatus;
    }

    public Integer getVerifiedBy() {
        return verifiedBy;
    }

    public void setVerifiedBy(Integer verifiedBy) {
        this.verifiedBy = verifiedBy;
    }

    public LocalDateTime getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(LocalDateTime verifiedAt) {
        this.verifiedAt = verifiedAt;
    }

    public String getVerificationNotes() {
        return verificationNotes;
    }

    public void setVerificationNotes(String verificationNotes) {
        this.verificationNotes = verificationNotes;
    }

    public String getResultDocumentPath() {
        return resultDocumentPath;
    }

    public void setResultDocumentPath(String resultDocumentPath) {
        this.resultDocumentPath = resultDocumentPath;
    }
}
