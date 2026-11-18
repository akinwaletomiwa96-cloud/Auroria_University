package edu.auroria.auroria_backend.user.controller;

import edu.auroria.auroria_backend.user.entity.StudentProfile;
import edu.auroria.auroria_backend.user.entity.User;
import edu.auroria.auroria_backend.user.repository.StudentProfileRepository;
import edu.auroria.auroria_backend.user.repository.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/admin/students")
public class StudentManagementController {

    private static final String STUDENT_ROLE = "STUDENT";

    private final UserRepository userRepository;
    private final StudentProfileRepository profileRepository;

    public StudentManagementController(
            UserRepository userRepository,
            StudentProfileRepository profileRepository
    ) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
    }

    // =====================================================
    // STUDENT LIST, SEARCH, FILTER AND STATISTICS
    // =====================================================

    @GetMapping
    public StudentPageResponse getStudents(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {

        page = Math.max(page, 0);
        size = Math.max(1, Math.min(size, 100));

        List<User> allStudents =
                userRepository.findByRole_RoleNameIgnoreCase(STUDENT_ROLE);

        long totalStudents = allStudents.size();

        long activeStudents = allStudents.stream()
                .filter(user -> isStatus(user, "ACTIVE"))
                .count();

        long inactiveStudents = allStudents.stream()
                .filter(user -> isStatus(user, "INACTIVE"))
                .count();

        long suspendedStudents = allStudents.stream()
                .filter(user -> isStatus(user, "SUSPENDED"))
                .count();

        long verifiedStudents = allStudents.stream()
                .filter(User::isEmailVerified)
                .count();

        String searchTerm = search.trim().toLowerCase(Locale.ROOT);
        String statusFilter = status.trim().toLowerCase(Locale.ROOT);

        List<StudentListItem> filtered = allStudents.stream()
                .filter(user -> {
                    if (searchTerm.isEmpty()) {
                        return true;
                    }

                    return contains(user.getFullName(), searchTerm)
                            || contains(user.getEmail(), searchTerm)
                            || contains(user.getPhone(), searchTerm)
                            || String.valueOf(user.getUserId())
                            .contains(searchTerm);
                })
                .filter(user -> {
                    if (statusFilter.isEmpty()
                            || statusFilter.equals("all")) {
                        return true;
                    }

                    return normalise(user.getAccountStatus())
                            .equals(statusFilter);
                })
                .sorted((a, b) -> {
                    LocalDateTime dateA = a.getCreatedAt();
                    LocalDateTime dateB = b.getCreatedAt();

                    if (dateA == null && dateB == null) return 0;
                    if (dateA == null) return 1;
                    if (dateB == null) return -1;

                    return dateB.compareTo(dateA);
                })
                .map(this::toListItem)
                .toList();

        int totalElements = filtered.size();
        int totalPages = (int) Math.ceil((double) totalElements / size);

        int fromIndex = Math.min(page * size, totalElements);
        int toIndex = Math.min(fromIndex + size, totalElements);

        List<StudentListItem> pageItems =
                filtered.subList(fromIndex, toIndex);

        StudentStatistics statistics = new StudentStatistics(
                totalStudents,
                activeStudents,
                inactiveStudents,
                suspendedStudents,
                verifiedStudents,
                totalStudents - verifiedStudents
        );

        return new StudentPageResponse(
                true,
                statistics,
                pageItems,
                page,
                size,
                totalElements,
                totalPages
        );
    }

    // =====================================================
    // INDIVIDUAL STUDENT DETAILS
    // =====================================================

    @GetMapping("/{userId}")
    public StudentDetailsResponse getStudentDetails(
            @PathVariable Integer userId
    ) {

        User user = userRepository
                .findByUserIdAndRole_RoleNameIgnoreCase(
                        userId,
                        STUDENT_ROLE
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Student account not found."
                ));

        StudentProfile profile = profileRepository
                .findByUser_UserId(userId)
                .orElse(null);

        StudentProfileDetails profileDetails = profile == null
                ? null
                : new StudentProfileDetails(
                profile.getDateOfBirth(),
                profile.getNationality(),
                profile.getStateOfOrigin(),
                profile.getEmergencyContact(),
                profile.getAddress()
        );

        return new StudentDetailsResponse(
                true,
                toListItem(user),
                profileDetails
        );
    }

    // =====================================================
    // DTO MAPPING
    // =====================================================

    private StudentListItem toListItem(User user) {
        return new StudentListItem(
                user.getUserId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getAccountStatus(),
                user.isEmailVerified(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }

    private boolean isStatus(User user, String expected) {
        return normalise(user.getAccountStatus())
                .equals(expected.toLowerCase(Locale.ROOT));
    }

    private boolean contains(String value, String search) {
        return value != null
                && value.toLowerCase(Locale.ROOT).contains(search);
    }

    private String normalise(String value) {
        return value == null
                ? ""
                : value.trim().toLowerCase(Locale.ROOT);
    }

    // =====================================================
    // RESPONSE RECORDS
    // =====================================================

    public record StudentStatistics(
            long totalStudents,
            long activeStudents,
            long inactiveStudents,
            long suspendedStudents,
            long verifiedStudents,
            long unverifiedStudents
    ) {}

    public record StudentListItem(
            Integer userId,
            String fullName,
            String email,
            String phone,
            String accountStatus,
            boolean emailVerified,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record StudentProfileDetails(
            LocalDate dateOfBirth,
            String nationality,
            String stateOfOrigin,
            String emergencyContact,
            String address
    ) {}

    public record StudentDetailsResponse(
            boolean success,
            StudentListItem student,
            StudentProfileDetails profile
    ) {}

    public record StudentPageResponse(
            boolean success,
            StudentStatistics statistics,
            List<StudentListItem> students,
            int page,
            int size,
            int totalElements,
            int totalPages
    ) {}
}