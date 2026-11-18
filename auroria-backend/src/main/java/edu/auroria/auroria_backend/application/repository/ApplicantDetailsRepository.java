package edu.auroria.auroria_backend.application.repository;

import edu.auroria.auroria_backend.application.entity.ApplicantDetails;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ApplicantDetailsRepository
        extends JpaRepository<ApplicantDetails, Long> {

    Optional<ApplicantDetails> findByApplication_ApplicationId(
            Long applicationId
    );
}
