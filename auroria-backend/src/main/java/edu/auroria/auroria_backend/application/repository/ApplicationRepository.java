package edu.auroria.auroria_backend.application.repository;

import edu.auroria.auroria_backend.application.entity.Application;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApplicationRepository
        extends JpaRepository<Application, Long> {

    boolean existsByReferenceCode(String referenceCode);

    Optional<Application> findByReferenceCode(String referenceCode);

    List<Application> findByUser_UserId(Integer userId);

    long countByUser_UserIdAndApplicationStatusNot(
            Integer userId,
            String applicationStatus
    );

    boolean existsByUser_UserIdAndCourse_CourseIdAndApplicationStatusNot(
            Integer userId,
            Integer courseId,
            String applicationStatus
    );

    Optional<Application>
    findFirstByUser_UserIdAndApplicationStatusOrderByApplicationIdDesc(
            Integer userId,
            String applicationStatus
    );

    // Admissions overview statistics

    long countBySubmittedAtIsNotNull();

    long countByApplicationStatus(String applicationStatus);

    // Latest 10 submitted applications

    List<Application>
    findTop10BySubmittedAtIsNotNullOrderBySubmittedAtDesc();
}