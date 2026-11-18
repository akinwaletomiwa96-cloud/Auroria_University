package edu.auroria.auroria_backend.user.controller;

import edu.auroria.auroria_backend.user.entity.User;
import edu.auroria.auroria_backend.user.entity.StudentProfile;
import edu.auroria.auroria_backend.user.repository.UserRepository;
import edu.auroria.auroria_backend.user.repository.StudentProfileRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/applicants")
public class AdminApplicantController {

    private final UserRepository userRepository;
    private final StudentProfileRepository profileRepository;

    public AdminApplicantController(
            UserRepository userRepository,
            StudentProfileRepository profileRepository) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
    }

    // GET /api/admin/applicants
    @GetMapping
    public ResponseEntity<Map<String, Object>> getApplicants(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        // Only accounts with the APPLICANT role.
        List<User> allApplicants =
                userRepository.findByRole_RoleNameIgnoreCase("APPLICANT");

        // Statistics are calculated before applying filters.
        Map<String, Object> statistics = new LinkedHashMap<>();

        statistics.put("totalApplicants", allApplicants.size());

        statistics.put("activeApplicants",
                allApplicants.stream()
                        .filter(u -> "ACTIVE".equalsIgnoreCase(u.getAccountStatus()))
                        .count());

        statistics.put("inactiveApplicants",
                allApplicants.stream()
                        .filter(u -> "INACTIVE".equalsIgnoreCase(u.getAccountStatus()))
                        .count());

        statistics.put("unverifiedApplicants",
                allApplicants.stream()
                        .filter(u -> !u.isEmailVerified())
                        .count());

        String keyword = search.trim().toLowerCase();
        String selectedStatus = status.trim().toLowerCase();

        List<User> filtered = allApplicants.stream()

                .filter(u -> {
                    if (keyword.isEmpty()) {
                        return true;
                    }

                    return contains(u.getFullName(), keyword)
                            || contains(u.getEmail(), keyword)
                            || contains(u.getPhone(), keyword)
                            || String.valueOf(u.getUserId()).contains(keyword);
                })

                .filter(u -> {
                    if ("all".equals(selectedStatus)) {
                        return true;
                    }

                    return u.getAccountStatus() != null
                            && u.getAccountStatus().equalsIgnoreCase(selectedStatus);
                })

                .sorted(Comparator.comparing(
                        User::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))

                .collect(Collectors.toList());

        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);

        int totalElements = filtered.size();
        int totalPages = (int) Math.ceil((double) totalElements / safeSize);

        int start = Math.min(safePage * safeSize, totalElements);
        int end = Math.min(start + safeSize, totalElements);

        List<Map<String, Object>> applicants = filtered
                .subList(start, end)
                .stream()
                .map(this::toApplicantResponse)
                .collect(Collectors.toList());

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("applicants", applicants);
        response.put("statistics", statistics);
        response.put("page", safePage);
        response.put("size", safeSize);
        response.put("totalPages", totalPages);
        response.put("totalElements", totalElements);

        return ResponseEntity.ok(response);
    }

    // GET /api/admin/applicants/{id}
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getApplicant(
            @PathVariable Integer id) {

        Optional<User> optionalUser =
                userRepository.findByUserIdAndRole_RoleNameIgnoreCase(
                        id, "APPLICANT"
                );

        if (optionalUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User applicant = optionalUser.get();

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("applicant", toApplicantResponse(applicant));

        Optional<StudentProfile> optionalProfile =
                profileRepository.findByUser_UserId(id);

        if (optionalProfile.isPresent()) {
            StudentProfile profile = optionalProfile.get();

            Map<String, Object> profileData = new LinkedHashMap<>();

            profileData.put("dateOfBirth", profile.getDateOfBirth());
            profileData.put("nationality", profile.getNationality());
            profileData.put("stateOfOrigin", profile.getStateOfOrigin());
            profileData.put("emergencyContact", profile.getEmergencyContact());
            profileData.put("address", profile.getAddress());

            response.put("profile", profileData);
        } else {
            response.put("profile", new LinkedHashMap<>());
        }

        return ResponseEntity.ok(response);
    }

    private Map<String, Object> toApplicantResponse(User user) {

        Map<String, Object> data = new LinkedHashMap<>();

        data.put("userId", user.getUserId());
        data.put("fullName", user.getFullName());
        data.put("email", user.getEmail());
        data.put("phone", user.getPhone());
        data.put("accountStatus", user.getAccountStatus());
        data.put("emailVerified", user.isEmailVerified());
        data.put("createdAt", user.getCreatedAt());
        data.put("updatedAt", user.getUpdatedAt());

        return data;
    }

    private boolean contains(String value, String keyword) {
        return value != null
                && value.toLowerCase().contains(keyword);
    }
}
