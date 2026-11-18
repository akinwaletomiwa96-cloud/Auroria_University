package edu.auroria.auroria_backend.application.dto;

public record AcademicRecordRequest(
        String institutionName,
        String qualificationName,
        String examinationBody,
        String examinationNumber,
        Short examinationYear,
        String subjectName,
        String gradeObtained,
        String resultDocumentPath
) {}
