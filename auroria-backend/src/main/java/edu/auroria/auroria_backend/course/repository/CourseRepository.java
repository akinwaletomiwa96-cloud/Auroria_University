package edu.auroria.auroria_backend.course.repository;

import edu.auroria.auroria_backend.course.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CourseRepository
        extends JpaRepository<Course, Integer> {

    boolean existsByCourseCodeIgnoreCase(String courseCode);

    @Query("""
        SELECT c FROM Course c
        WHERE (:search IS NULL
               OR LOWER(c.courseName) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(c.courseCode) LIKE LOWER(CONCAT('%', :search, '%')))
          AND (:departmentId IS NULL
               OR c.department.departmentId = :departmentId)
          AND (:availableOnly = false OR c.available = true)
        ORDER BY c.courseName ASC
        """)
    List<Course> searchCourses(
            @Param("search") String search,
            @Param("departmentId") Integer departmentId,
            @Param("availableOnly") boolean availableOnly
    );
}