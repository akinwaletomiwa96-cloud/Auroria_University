package edu.auroria.auroria_backend.application.dto;

import java.time.LocalDateTime;

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