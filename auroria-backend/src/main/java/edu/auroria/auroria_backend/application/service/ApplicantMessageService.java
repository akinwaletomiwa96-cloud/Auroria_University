package edu.auroria.auroria_backend.application.service;

import edu.auroria.auroria_backend.application.entity.Application;
import edu.auroria.auroria_backend.application.repository.ApplicationRepository;
import edu.auroria.auroria_backend.application.entity.ApplicantMessage;
import edu.auroria.auroria_backend.application.repository.ApplicantMessageRepository;
import edu.auroria.auroria_backend.user.entity.User;
import edu.auroria.auroria_backend.user.repository.UserRepository;


import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ApplicantMessageService {

    private final ApplicantMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final ApplicantEmailService emailService;

    public ApplicantMessageService(ApplicantMessageRepository messageRepository, UserRepository userRepository, ApplicationRepository applicationRepository, ApplicantEmailService emailService) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.applicationRepository = applicationRepository;
        this.emailService = emailService;
    }

    // Send a message to an applicant
    @Transactional
    public ApplicantMessage sendMessage(
            Integer senderId,
            Integer recipientId,
            Long applicationId,
            String messageType,
            String subject,
            String body) {

        User sender = userRepository.findById(senderId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Sender not found."));

        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Applicant not found."));

        String senderRole = sender.getRole().getRoleName();
        String recipientRole = recipient.getRole().getRoleName();

        if (!"ADMIN".equalsIgnoreCase(senderRole)
                && !"ADMISSIONS_OFFICER".equalsIgnoreCase(senderRole)) {
            throw new IllegalArgumentException(
                    "Only admissions staff can send applicant messages."
            );
        }

        if (!"APPLICANT".equalsIgnoreCase(recipientRole)) {
            throw new IllegalArgumentException(
                    "Messages can only be sent to applicants."
            );
        }

        if (subject == null || subject.isBlank()) {
            throw new IllegalArgumentException("Message subject is required.");
        }

        if (body == null || body.isBlank()) {
            throw new IllegalArgumentException("Message body is required.");
        }

        Application application = null;

        if (applicationId != null) {
            application = applicationRepository.findById(applicationId)
                    .orElseThrow(() ->
                            new IllegalArgumentException(
                                    "Application not found."
                            ));

            if (!application.getUser().getUserId().equals(recipientId)) {
                throw new IllegalArgumentException(
                        "This application does not belong to the selected applicant."
                );
            }
        }

        ApplicantMessage message = new ApplicantMessage();

        message.setSender(sender);
        message.setRecipient(recipient);
        message.setApplication(application);
        message.setMessageType(
                messageType == null || messageType.isBlank()
                        ? "GENERAL"
                        : messageType.trim().toUpperCase()
        );
        message.setSubject(subject.trim());
        message.setBody(body.trim());

        // Save the dashboard message first.
        message = messageRepository.save(message);

// Attempt email delivery without losing the dashboard message.
        message.setEmailStatus(emailService.send(message));

        return messageRepository.save(message);
    }

    // Get an applicant's inbox
    @Transactional(readOnly = true)
    public List<ApplicantMessage> getApplicantMessages(Integer userId) {

        return messageRepository
                .findByRecipient_UserIdAndDeletedAtIsNullOrderBySentAtDesc(userId);
    }

    // Get messages sent by a staff member
    @Transactional(readOnly = true)
    public List<ApplicantMessage> getSentMessages(Integer senderId) {

        return messageRepository
                .findBySender_UserIdOrderBySentAtDesc(senderId);
    }

    // Get unread messages
    @Transactional(readOnly = true)
    public List<ApplicantMessage> getUnreadMessages(Integer userId) {

        return messageRepository
                .findByRecipient_UserIdAndReadAtIsNullAndDeletedAtIsNullOrderBySentAtDesc(
                        userId
                );

    }

    // Count unread messages
    @Transactional(readOnly = true)
    public long countUnreadMessages(Integer userId) {

        return messageRepository
                .countByRecipient_UserIdAndReadAtIsNullAndDeletedAtIsNull(userId);
    }

    // Mark a message as read
    @Transactional
    public ApplicantMessage markAsRead(Long messageId, Integer userId) {

        ApplicantMessage message = messageRepository
                .findByMessageIdAndRecipient_UserIdAndDeletedAtIsNull(
                        messageId,
                        userId
                )
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Message not found."
                        ));

        if (message.getReadAt() == null) {
            message.setReadAt(LocalDateTime.now());
        }

        return messageRepository.save(message);
    }


    // Delete a message from the applicant's inbox without removing staff history.
    @Transactional
    public void deleteApplicantMessage(Long messageId, Integer userId) {

        ApplicantMessage message = messageRepository
                .findByMessageIdAndRecipient_UserIdAndDeletedAtIsNull(
                        messageId,
                        userId
                )
                .orElseThrow(() ->
                        new IllegalArgumentException("Message not found.")
                );

        message.setDeletedAt(LocalDateTime.now());

        messageRepository.save(message);
    }

    // Get messages connected to an application
    @Transactional(readOnly = true)
    public List<ApplicantMessage> getApplicationMessages(
            Long applicationId) {

        if (!applicationRepository.existsById(applicationId)) {
            throw new IllegalArgumentException("Application not found.");
        }

        return messageRepository
                .findByApplication_ApplicationIdOrderBySentAtDesc(
                        applicationId
                );
    }
}