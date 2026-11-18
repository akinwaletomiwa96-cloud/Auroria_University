package edu.auroria.auroria_backend.course.service;

import edu.auroria.auroria_backend.course.entity.Course;
import edu.auroria.auroria_backend.course.entity.Department;
import edu.auroria.auroria_backend.course.repository.CourseRepository;
import edu.auroria.auroria_backend.course.repository.DepartmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional
public class CourseService {

    private final CourseRepository courseRepository;
    private final DepartmentRepository departmentRepository;

    public CourseService(
            CourseRepository courseRepository,
            DepartmentRepository departmentRepository) {
        this.courseRepository = courseRepository;
        this.departmentRepository = departmentRepository;
    }

    @Transactional(readOnly = true)
    public List<Course> getCourses(
            String search,
            Integer departmentId,
            boolean availableOnly) {

        String cleanedSearch =
                (search == null || search.isBlank())
                        ? null
                        : search.trim();

        return courseRepository.searchCourses(
                cleanedSearch,
                departmentId,
                availableOnly
        );
    }

    @Transactional(readOnly = true)
    public Course getCourseById(Integer courseId) {
        return courseRepository.findById(courseId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Course not found: " + courseId
                        ));
    }

    public Course createCourse(Course course) {
        validateCourse(course);

        String code = course.getCourseCode().trim();

        if (courseRepository.existsByCourseCodeIgnoreCase(code)) {
            throw new IllegalArgumentException(
                    "A course with this course code already exists."
            );
        }

        Department department = getDepartment(
                course.getDepartment().getDepartmentId()
        );

        course.setCourseId(null);
        course.setCourseCode(code);
        course.setCourseName(course.getCourseName().trim());
        course.setDepartment(department);

        return courseRepository.save(course);
    }

    public Course updateCourse(Integer courseId, Course updatedCourse) {
        validateCourse(updatedCourse);

        Course existing = getCourseById(courseId);
        String newCode = updatedCourse.getCourseCode().trim();

        boolean codeChanged =
                !existing.getCourseCode().equalsIgnoreCase(newCode);

        if (codeChanged
                && courseRepository.existsByCourseCodeIgnoreCase(newCode)) {
            throw new IllegalArgumentException(
                    "A course with this course code already exists."
            );
        }

        Department department = getDepartment(
                updatedCourse.getDepartment().getDepartmentId()
        );

        existing.setCourseCode(newCode);
        existing.setCourseName(updatedCourse.getCourseName().trim());
        existing.setDescription(updatedCourse.getDescription());
        existing.setDurationYears(updatedCourse.getDurationYears());
        existing.setEstimatedFee(updatedCourse.getEstimatedFee());
        existing.setCourseLevel(updatedCourse.getCourseLevel().trim());
        existing.setDepartment(department);
        existing.setAvailable(updatedCourse.getAvailable());

        return courseRepository.save(existing);
    }

    public void deleteCourse(Integer courseId) {
        Course course = getCourseById(courseId);

        // Hard deletion may fail if an application references this course.
        // Prefer setting available=false once application workflows exist.
        courseRepository.delete(course);
    }

    private Department getDepartment(Integer departmentId) {
        if (departmentId == null) {
            throw new IllegalArgumentException(
                    "A department must be selected."
            );
        }

        return departmentRepository.findById(departmentId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Department not found: " + departmentId
                        ));
    }

    private void validateCourse(Course course) {
        if (course == null) {
            throw new IllegalArgumentException(
                    "Course information is required."
            );
        }

        if (course.getCourseCode() == null
                || course.getCourseCode().isBlank()) {
            throw new IllegalArgumentException(
                    "Course code is required."
            );
        }

        if (course.getCourseName() == null
                || course.getCourseName().isBlank()) {
            throw new IllegalArgumentException(
                    "Course name is required."
            );
        }

        if (course.getDepartment() == null
                || course.getDepartment().getDepartmentId() == null) {
            throw new IllegalArgumentException(
                    "A valid department is required."
            );
        }

        if (course.getDurationYears() == null
                || course.getDurationYears() <= 0) {
            throw new IllegalArgumentException(
                    "Duration must be greater than zero."
            );
        }

        BigDecimal fee = course.getEstimatedFee();

        if (fee == null || fee.signum() < 0) {
            throw new IllegalArgumentException(
                    "Estimated fee cannot be negative."
            );
        }

        if (course.getCourseLevel() == null
                || course.getCourseLevel().isBlank()) {
            throw new IllegalArgumentException(
                    "Course level is required."
            );
        }

        if (course.getAvailable() == null) {
            course.setAvailable(true);
        }
    }
}