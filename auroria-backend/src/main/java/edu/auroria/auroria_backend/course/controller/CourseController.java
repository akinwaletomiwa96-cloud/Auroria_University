package edu.auroria.auroria_backend.course.controller;

import edu.auroria.auroria_backend.course.entity.Course;
import edu.auroria.auroria_backend.course.service.CourseService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/courses")
@CrossOrigin(origins = {
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://localhost:5500",
        "http://127.0.0.1:5500"
})
public class CourseController {

    private final CourseService courseService;

    public CourseController(CourseService courseService) {
        this.courseService = courseService;
    }

    // GET /api/courses
    // GET /api/courses?search=computer
    // GET /api/courses?departmentId=1
    // GET /api/courses?availableOnly=false
    @GetMapping
    public List<Course> getCourses(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer departmentId,
            @RequestParam(defaultValue = "false") boolean availableOnly) {

        return courseService.getCourses(
                search,
                departmentId,
                availableOnly
        );
    }

    // GET /api/courses/1
    @GetMapping("/{courseId}")
    public Course getCourse(@PathVariable Integer courseId) {
        return courseService.getCourseById(courseId);
    }

    // POST /api/courses
    @PostMapping
    public ResponseEntity<Course> createCourse(
            @RequestBody Course course) {

        Course created = courseService.createCourse(course);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(created);
    }

    // PUT /api/courses/1
    @PutMapping("/{courseId}")
    public Course updateCourse(
            @PathVariable Integer courseId,
            @RequestBody Course course) {

        return courseService.updateCourse(courseId, course);
    }

    // DELETE /api/courses/1
    @DeleteMapping("/{courseId}")
    public ResponseEntity<Void> deleteCourse(
            @PathVariable Integer courseId) {

        courseService.deleteCourse(courseId);

        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(
            IllegalArgumentException exception) {

        return ResponseEntity
                .badRequest()
                .body(Map.of("error", exception.getMessage()));
    }
}
