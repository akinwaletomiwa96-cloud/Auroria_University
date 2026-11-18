package edu.auroria.auroria_backend.application.controller;

import edu.auroria.auroria_backend.application.entity.ApplicantMessage;
import edu.auroria.auroria_backend.application.service.ApplicantMessageService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/communication")
@CrossOrigin(origins = "*")
public class ApplicantMessageController {

    private final ApplicantMessageService messageService;

    public ApplicantMessageController(
            ApplicantMessageService messageService) {
        this.messageService = messageService;
    }

    // Admissions staff sends a message
    @PostMapping("/messages")
    public ResponseEntity<?> sendMessage(
            @RequestBody SendMessageRequest request) {

        try {
            ApplicantMessage message = messageService.sendMessage(
                    request.senderId(),
                    request.recipientId(),
                    request.applicationId(),
                    request.messageType(),
                    request.subject(),
                    request.body()
            );

            return ResponseEntity.ok(toResponse(message));

        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(
                    new ErrorResponse(exception.getMessage())
            );
        }
    }

    // Applicant inbox
    @GetMapping("/applicant/{userId}/messages")
    public ResponseEntity<List<MessageResponse>> getApplicantMessages(
            @PathVariable Integer userId) {

        List<MessageResponse> messages = messageService
                .getApplicantMessages(userId)
                .stream()
                .map(this::toResponse)
                .toList();

        return ResponseEntity.ok(messages);
    }

    // Applicant unread messages
    @GetMapping("/applicant/{userId}/messages/unread")
    public ResponseEntity<List<MessageResponse>> getUnreadMessages(
            @PathVariable Integer userId) {

        List<MessageResponse> messages = messageService
                .getUnreadMessages(userId)
                .stream()
                .map(this::toResponse)
                .toList();

        return ResponseEntity.ok(messages);
    }

    // Applicant unread count
    @GetMapping("/applicant/{userId}/messages/unread/count")
    public ResponseEntity<Long> countUnreadMessages(
            @PathVariable Integer userId) {

        return ResponseEntity.ok(
                messageService.countUnreadMessages(userId)
        );
    }

    // Delete a message from the applicant's inbox.
    @DeleteMapping("/applicant/{userId}/messages/{messageId}")
    public ResponseEntity<?> deleteApplicantMessage(
            @PathVariable Integer userId,
            @PathVariable Long messageId) {

        try {
            messageService.deleteApplicantMessage(messageId, userId);

            return ResponseEntity.noContent().build();

        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(
                    new ErrorResponse(exception.getMessage())
            );
        }
    }

    // Mark a message as read
    @PatchMapping("/applicant/{userId}/messages/{messageId}/read")
    public ResponseEntity<?> markAsRead(
            @PathVariable Integer userId,
            @PathVariable Long messageId) {

        try {
            ApplicantMessage message = messageService.markAsRead(
                    messageId,
                    userId
            );

            return ResponseEntity.ok(toResponse(message));

        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(
                    new ErrorResponse(exception.getMessage())
            );
        }
    }

    // Staff message history
    @GetMapping("/staff/{senderId}/sent")
    public ResponseEntity<List<MessageResponse>> getSentMessages(
            @PathVariable Integer senderId) {

        List<MessageResponse> messages = messageService
                .getSentMessages(senderId)
                .stream()
                .map(this::toResponse)
                .toList();

        return ResponseEntity.ok(messages);
    }

    // Application-specific message history
    @GetMapping("/application/{applicationId}/messages")
    public ResponseEntity<List<MessageResponse>> getApplicationMessages(
            @PathVariable Long applicationId) {

        List<MessageResponse> messages = messageService
                .getApplicationMessages(applicationId)
                .stream()
                .map(this::toResponse)
                .toList();

        return ResponseEntity.ok(messages);
    }

    private MessageResponse toResponse(ApplicantMessage message) {

        return new MessageResponse(
                message.getMessageId(),
                message.getRecipient().getUserId(),
                message.getRecipient().getFullName(),
                message.getRecipient().getEmail(),
                message.getSender().getUserId(),
                message.getSender().getFullName(),
                message.getApplication() == null
                        ? null
                        : message.getApplication().getApplicationId(),
                message.getApplication() == null
                        ? null
                        : message.getApplication().getReferenceCode(),
                message.getMessageType(),
                message.getSubject(),
                message.getBody(),
                message.getSentAt(),
                message.getReadAt(),
                message.isRead(),
                message.getEmailStatus()
        );
    }

    public record SendMessageRequest(
            Integer senderId,
            Integer recipientId,
            Long applicationId,
            String messageType,
            String subject,
            String body
    ) {}

    public record MessageResponse(
            Long messageId,
            Integer recipientId,
            String recipientName,
            String recipientEmail,
            Integer senderId,
            String senderName,
            Long applicationId,
            String applicationReference,
            String messageType,
            String subject,
            String body,
            LocalDateTime sentAt,
            LocalDateTime readAt,
            boolean read,
            String emailStatus
    ) {}

    public record ErrorResponse(String message) {}
}