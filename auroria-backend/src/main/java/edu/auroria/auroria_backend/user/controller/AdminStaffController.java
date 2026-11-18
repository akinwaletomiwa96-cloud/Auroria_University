package edu.auroria.auroria_backend.user.controller;

import edu.auroria.auroria_backend.user.entity.User;
import edu.auroria.auroria_backend.user.repository.UserRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import edu.auroria.auroria_backend.user.entity.Role;
import edu.auroria.auroria_backend.user.repository.RoleRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/staff")
public class AdminStaffController {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminStaffController(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder) {

        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }
    @GetMapping
    public ResponseEntity<Map<String, Object>> getStaff(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        List<User> allStaff = userRepository.findAll().stream()
                .filter(user -> user.getRole() != null)
                .filter(user -> user.getRole().getRoleName() != null)
                .filter(user -> !"APPLICANT".equalsIgnoreCase(
                        user.getRole().getRoleName()))
                .collect(Collectors.toList());

        Map<String, Object> statistics = new LinkedHashMap<>();
        statistics.put("totalStaff", allStaff.size());
        statistics.put("activeStaff", allStaff.stream()
                .filter(u -> "ACTIVE".equalsIgnoreCase(u.getAccountStatus()))
                .count());
        statistics.put("inactiveStaff", allStaff.stream()
                .filter(u -> "INACTIVE".equalsIgnoreCase(u.getAccountStatus()))
                .count());
        statistics.put("unverifiedStaff", allStaff.stream()
                .filter(u -> !u.isEmailVerified())
                .count());

        String keyword = search.trim().toLowerCase();
        String selectedStatus = status.trim().toLowerCase();

        List<User> filtered = allStaff.stream()
                .filter(user ->
                        keyword.isEmpty()
                                || contains(user.getFullName(), keyword)
                                || contains(user.getEmail(), keyword)
                                || contains(user.getPhone(), keyword)
                                || contains(user.getRole().getRoleName(), keyword)
                                || String.valueOf(user.getUserId()).contains(keyword))
                .filter(user ->
                        "all".equals(selectedStatus)
                                || (user.getAccountStatus() != null
                                && user.getAccountStatus().equalsIgnoreCase(selectedStatus)))
                .sorted(Comparator.comparing(
                        User::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());

        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);

        int totalElements = filtered.size();
        int totalPages = (int) Math.ceil((double) totalElements / safeSize);
        int start = Math.min(safePage * safeSize, totalElements);
        int end = Math.min(start + safeSize, totalElements);

        List<Map<String, Object>> staff = filtered.subList(start, end)
                .stream()
                .map(this::toStaffResponse)
                .collect(Collectors.toList());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("staff", staff);
        response.put("statistics", statistics);
        response.put("page", safePage);
        response.put("size", safeSize);
        response.put("totalPages", totalPages);
        response.put("totalElements", totalElements);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getStaffMember(
            @PathVariable Integer id) {

        Optional<User> optionalUser = userRepository.findById(id);

        if (optionalUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = optionalUser.get();

        if (user.getRole() == null
                || "APPLICANT".equalsIgnoreCase(user.getRole().getRoleName())) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("staff", toStaffResponse(user));

        return ResponseEntity.ok(response);
    }

    private Map<String, Object> toStaffResponse(User user) {
        Map<String, Object> data = new LinkedHashMap<>();

        data.put("userId", user.getUserId());
        data.put("fullName", user.getFullName());
        data.put("email", user.getEmail());
        data.put("phone", user.getPhone());
        data.put("role", user.getRole() != null
                ? user.getRole().getRoleName()
                : null);
        data.put("accountStatus", user.getAccountStatus());
        data.put("emailVerified", user.isEmailVerified());
        data.put("createdAt", user.getCreatedAt());
        data.put("updatedAt", user.getUpdatedAt());

        return data;
    }
    @PostMapping
    public ResponseEntity<Map<String, Object>> createAdmissionsOfficer(
            @RequestBody Map<String, String> request) {

        String fullName = request.getOrDefault("fullName", "").trim();
        String email = request.getOrDefault("email", "").trim();
        String phone = request.getOrDefault("phone", "").trim();
        String password = request.getOrDefault("password", "");

        if (fullName.isBlank() || email.isBlank()
                || phone.isBlank() || password.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "All fields are required."
            );
        }

        if (!email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Enter a valid email address."
            );
        }

        if (password.length() < 8) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password must contain at least 8 characters."
            );
        }

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "An account with this email already exists."
            );
        }

        Role admissionsRole = roleRepository
                .findByRoleName("ADMISSIONS_OFFICER")
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "ADMISSIONS_OFFICER role was not found."
                ));

        User user = new User();

        user.setFullName(fullName);
        user.setEmail(email);
        user.setPhone(phone);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(admissionsRole);
        user.setAccountStatus("ACTIVE");
        user.setEmailVerified(false);

        User savedUser = userRepository.saveAndFlush(user);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Admissions officer registered successfully.");
        response.put("staff", toStaffResponse(savedUser));

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    private boolean contains(String value, String keyword) {
        return value != null
                && value.toLowerCase().contains(keyword);
    }
}