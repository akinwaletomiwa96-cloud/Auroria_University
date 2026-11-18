package edu.auroria.auroria_backend.application.repository;

import edu.auroria.auroria_backend.application.entity.ApplicantMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApplicantMessageRepository
        extends JpaRepository<ApplicantMessage, Long> {

    // Only messages still visible in the applicant's inbox.
    List<ApplicantMessage> findByRecipient_UserIdAndDeletedAtIsNullOrderBySentAtDesc(
            Integer userId
    );

    // Staff sent-message history remains available after applicant deletion.
    List<ApplicantMessage> findBySender_UserIdOrderBySentAtDesc(
            Integer userId
    );

    // Only unread messages that have not been deleted.
    List<ApplicantMessage> findByRecipient_UserIdAndReadAtIsNullAndDeletedAtIsNullOrderBySentAtDesc(
            Integer userId
    );

    long countByRecipient_UserIdAndReadAtIsNullAndDeletedAtIsNull(
            Integer userId
    );

    // Find a visible message belonging to this applicant.
    Optional<ApplicantMessage> findByMessageIdAndRecipient_UserIdAndDeletedAtIsNull(
            Long messageId,
            Integer userId
    );

    List<ApplicantMessage> findByApplication_ApplicationIdOrderBySentAtDesc(
            Long applicationId
    );
} 