
package edu.auroria.auroria_backend.user.repository;

import edu.auroria.auroria_backend.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {

    boolean existsByEmailIgnoreCase(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    List<User> findByRole_RoleNameIgnoreCase(String roleName);

    Optional<User> findByUserIdAndRole_RoleNameIgnoreCase(
            Integer userId,
            String roleName
    );

    // Admin overview counts
    long countByRole_RoleNameIgnoreCase(String roleName);

    // Latest registrations for a specific role
    List<User> findTop5ByRole_RoleNameIgnoreCaseOrderByCreatedAtDesc(
            String roleName
    );

    // Latest registrations across all roles
    List<User> findTop5ByOrderByCreatedAtDesc();
}
