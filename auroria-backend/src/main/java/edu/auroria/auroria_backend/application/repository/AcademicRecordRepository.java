package edu.auroria.auroria_backend.application.repository;

import edu.auroria.auroria_backend.application.entity.AcademicRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AcademicRecordRepository
        extends JpaRepository<AcademicRecord, Long> {

    List<AcademicRecord> findByApplication_ApplicationId(
            Long applicationId
    );
}
