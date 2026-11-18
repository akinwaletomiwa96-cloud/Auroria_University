package edu.auroria.auroria_backend.application.repository;

import edu.auroria.auroria_backend.application.entity.ApplicationDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApplicationDocumentRepository
        extends JpaRepository<ApplicationDocument, Long> {

    List<ApplicationDocument> findByApplication_ApplicationId(
            Long applicationId
    );

    // Admissions overview statistics

    long countByVerificationStatus(String verificationStatus);

    List<ApplicationDocument>
    findTop10ByVerificationStatusOrderByUploadedAtDesc(
            String verificationStatus
    );
}