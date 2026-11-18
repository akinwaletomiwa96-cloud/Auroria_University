package edu.auroria.auroria_backend.user.repository;

import edu.auroria.auroria_backend.user.entity.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StudentProfileRepository
        extends JpaRepository<StudentProfile, Integer> {

    Optional<StudentProfile> findByUser_UserId(Integer userId);
}