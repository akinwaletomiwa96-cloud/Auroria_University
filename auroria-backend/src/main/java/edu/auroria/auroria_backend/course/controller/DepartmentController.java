package edu.auroria.auroria_backend.course.controller;

import edu.auroria.auroria_backend.course.service.DepartmentService;
import edu.auroria.auroria_backend.course.entity.Department;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/departments")
@CrossOrigin(origins = {
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://localhost:5500",
        "http://127.0.0.1:5500"
})
public class DepartmentController {

    private final DepartmentService departmentService;

    public DepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    @GetMapping
    public List<Department> getDepartments() {
        return departmentService.getAllDepartments();
    }
}
