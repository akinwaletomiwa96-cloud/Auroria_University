package edu.auroria.auroria_backend.course.repository;

import edu.auroria.auroria_backend.course.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DepartmentRepository
        extends JpaRepository<Department, Integer> {

    boolean existsByDepartmentNameIgnoreCase(String departmentName);
}