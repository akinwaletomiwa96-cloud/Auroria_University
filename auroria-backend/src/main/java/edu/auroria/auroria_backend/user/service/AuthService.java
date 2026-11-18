package edu.auroria.auroria_backend.user.service;


import edu.auroria.auroria_backend.user.dto.RegisterRequest;
import edu.auroria.auroria_backend.user.entity.User;
import edu.auroria.auroria_backend.user.entity.Role;
import edu.auroria.auroria_backend.user.repository.RoleRepository;
import edu.auroria.auroria_backend.user.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private static final Pattern PHONE_PATTERN =
            Pattern.compile("^[+0-9()\\- ]{7,25}$");

    public AuthService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder) {

        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public User register(RegisterRequest request) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "Registration details are required.");
        }

        String fullName = request.getFullName() == null
                ? "" : request.getFullName().trim();

        String email = request.getEmail() == null
                ? "" : request.getEmail().trim()
                .toLowerCase(Locale.ROOT);

        String phone = request.getPhone() == null
                ? "" : request.getPhone().trim();

        String password = request.getPassword();

        if (fullName.length() < 2 || fullName.length() > 150) {
            throw new IllegalArgumentException(
                    "Full name must be between 2 and 150 characters.");
        }

        if (email.isEmpty() || email.length() > 150
                || !EMAIL_PATTERN.matcher(email).matches()) {
            throw new IllegalArgumentException(
                    "Please enter a valid email address.");
        }

        if (!phone.isEmpty()
                && !PHONE_PATTERN.matcher(phone).matches()) {
            throw new IllegalArgumentException(
                    "Please enter a valid phone number.");
        }

        if (password == null || password.length() < 8
                || password.length() > 72
                || !password.matches(".*[A-Z].*")
                || !password.matches(".*[a-z].*")
                || !password.matches(".*\\d.*")
                || !password.matches(".*[^A-Za-z0-9].*")) {
            throw new IllegalArgumentException(
                    "Password must be 8-72 characters and include " +
                            "uppercase, lowercase, a number and a special character.");
        }

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException(
                    "An account with this email already exists.");
        }

        Role applicantRole = roleRepository
                .findByRoleName("APPLICANT")
                .orElseThrow(() -> new IllegalStateException(
                        "APPLICANT role was not found in the roles table."));

        User user = new User();
        user.setFullName(fullName);
        user.setEmail(email);
        user.setPhone(phone.isEmpty() ? null : phone);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(applicantRole);
        user.setAccountStatus("ACTIVE");
        user.setEmailVerified(false);

        try {
            return userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw new IllegalArgumentException(
                    "An account with this email already exists.");
        }
    }

    @Transactional(readOnly = true)
    public User login(String email, String password) {
        if (email == null || email.isBlank()
                || password == null || password.isEmpty()) {
            throw new IllegalArgumentException(
                    "Invalid email or password.");
        }

        User user = userRepository.findByEmailIgnoreCase(
                email.trim()
        ).orElseThrow(() -> new IllegalArgumentException(
                "Invalid email or password."));

        if (!passwordEncoder.matches(
                password, user.getPasswordHash())) {
            throw new IllegalArgumentException(
                    "Invalid email or password.");
        }

        if (!"ACTIVE".equalsIgnoreCase(user.getAccountStatus())) {
            throw new IllegalArgumentException(
                    "Invalid email or password.");
        }

        return user;
    }

}
